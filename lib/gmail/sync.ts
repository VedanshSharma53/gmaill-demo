import { createServiceClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail/client";
import { withGmailBackoff, withGmailConcurrency } from "@/lib/gmail/backoff";
import {
  decodeBase64Url,
  extractHeader,
  parseEmailAddress,
  stripHtml,
} from "@/lib/gmail/mime";
import { classifyEmail } from "@/lib/ai/gemini";
import { summarizeEmail, summarizeThread } from "@/lib/ai/summarize";
import { embedEmailChunks } from "@/lib/ai/rag";
import type { EmailCategory } from "@/types";

const BATCH_SIZE = 50;

interface SyncCursor {
  page_token?: string;
  message_index?: number;
  message_ids?: string[];
  history_id?: string;
}

export interface SyncBatchResult {
  done: boolean;
  processed_count: number;
  total_estimate: number | null;
  job_id: string;
}

export async function runSyncBatch(
  userId: string,
  jobType: "full" | "incremental" = "full"
): Promise<SyncBatchResult> {
  const supabase = createServiceClient();
  const gmail = await getGmailClient(userId);

  let { data: job } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!job) {
    const { data: newJob } = await supabase
      .from("sync_jobs")
      .insert({
        user_id: userId,
        job_type: jobType,
        status: "running",
        cursor: {},
        processed_count: 0,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    job = newJob!;
  }

  await supabase
    .from("gmail_accounts")
    .update({ sync_status: "syncing" })
    .eq("user_id", userId);

  const cursor = (job.cursor ?? {}) as SyncCursor;

  try {
    if (jobType === "incremental" && cursor.history_id) {
      return await runIncrementalBatch(userId, job.id, cursor);
    }

    return await runFullBatch(userId, job.id, cursor, gmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await supabase
      .from("sync_jobs")
      .update({ status: "error", error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id);
    await supabase
      .from("gmail_accounts")
      .update({ sync_status: "error" })
      .eq("user_id", userId);
    throw error;
  }
}

async function runFullBatch(
  userId: string,
  jobId: string,
  cursor: SyncCursor,
  gmail: Awaited<ReturnType<typeof getGmailClient>>
): Promise<SyncBatchResult> {
  const supabase = createServiceClient();

  let messageIds = cursor.message_ids;
  let pageToken = cursor.page_token;
  let messageIndex = cursor.message_index ?? 0;

  if (!messageIds?.length) {
    const listResponse = await withGmailBackoff(() =>
      gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        pageToken,
      })
    );

    messageIds = listResponse.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
    pageToken = listResponse.data.nextPageToken ?? undefined;
    messageIndex = 0;

    const profile = await withGmailBackoff(() =>
      gmail.users.getProfile({ userId: "me" })
    );

    await supabase
      .from("sync_jobs")
      .update({
        total_estimate: profile.data.messagesTotal ?? null,
        cursor: { page_token: pageToken, message_ids: messageIds, message_index: 0 },
      })
      .eq("id", jobId);

    if (profile.data.historyId) {
      await supabase
        .from("gmail_accounts")
        .update({ last_history_id: profile.data.historyId })
        .eq("user_id", userId);
    }
  }

  const batch = messageIds.slice(messageIndex, messageIndex + BATCH_SIZE);
  let processed = 0;

  for (const messageId of batch) {
    try {
      await withGmailConcurrency(async () => {
        await processMessage(userId, gmail, messageId);
      });
      processed++;
    } catch (err) {
      console.error(`Failed to process message ${messageId}:`, err);
    }
  }

  const newIndex = messageIndex + batch.length;
  const hasMoreInPage = newIndex < messageIds.length;
  const done = !hasMoreInPage && !pageToken;

  const { data: currentJob } = await supabase
    .from("sync_jobs")
    .select("processed_count, total_estimate")
    .eq("id", jobId)
    .single();

  const processedCount = (currentJob?.processed_count ?? 0) + processed;

  if (done) {
    await supabase
      .from("sync_jobs")
      .update({
        status: "done",
        processed_count: processedCount,
        completed_at: new Date().toISOString(),
        cursor: {},
      })
      .eq("id", jobId);

    await supabase
      .from("gmail_accounts")
      .update({
        sync_status: "idle",
        last_full_sync_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    const nextCursor: SyncCursor = hasMoreInPage
      ? { page_token: pageToken, message_ids: messageIds, message_index: newIndex }
      : { page_token: pageToken, message_ids: [], message_index: 0 };

    await supabase
      .from("sync_jobs")
      .update({
        processed_count: processedCount,
        cursor: nextCursor,
      })
      .eq("id", jobId);
  }

  return {
    done,
    processed_count: processedCount,
    total_estimate: currentJob?.total_estimate ?? null,
    job_id: jobId,
  };
}

async function runIncrementalBatch(
  userId: string,
  jobId: string,
  cursor: SyncCursor
): Promise<SyncBatchResult> {
  const supabase = createServiceClient();
  const gmail = await getGmailClient(userId);

  const { data: account } = await supabase
    .from("gmail_accounts")
    .select("last_history_id")
    .eq("user_id", userId)
    .single();

  const startHistoryId = cursor.history_id ?? account?.last_history_id;
  if (!startHistoryId) {
    return runFullBatch(userId, jobId, {}, gmail);
  }

  try {
    const historyResponse = await withGmailBackoff(() =>
      gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
      })
    );

    const messageIds = new Set<string>();
    for (const record of historyResponse.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id) messageIds.add(added.message.id);
      }
    }

    let processed = 0;
    for (const messageId of messageIds) {
      try {
        await processMessage(userId, gmail, messageId);
        processed++;
      } catch (err) {
        console.error(`Incremental sync failed for ${messageId}:`, err);
      }
    }

    if (historyResponse.data.historyId) {
      await supabase
        .from("gmail_accounts")
        .update({ last_history_id: historyResponse.data.historyId })
        .eq("user_id", userId);
    }

    await supabase
      .from("sync_jobs")
      .update({
        status: "done",
        processed_count: processed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await supabase
      .from("gmail_accounts")
      .update({ sync_status: "idle" })
      .eq("user_id", userId);

    return { done: true, processed_count: processed, total_estimate: null, job_id: jobId };
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code: number }).code
        : 0;

    if (status === 404) {
      console.warn("History ID expired, falling back to full sync");
      await supabase
        .from("sync_jobs")
        .update({ cursor: {}, job_type: "full" })
        .eq("id", jobId);
      return runFullBatch(userId, jobId, {}, gmail);
    }
    throw error;
  }
}

async function processMessage(
  userId: string,
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  messageId: string
) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("user_id", userId)
    .eq("gmail_message_id", messageId)
    .maybeSingle();

  if (existing) return;

  const message = await withGmailBackoff(() =>
    gmail.users.messages.get({ userId: "me", id: messageId, format: "full" })
  );

  const payload = message.data;
  const threadIdGmail = payload.threadId!;
  const headers = payload.payload?.headers ?? [];

  const fromRaw = extractHeader(headers, "From") ?? "";
  const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
  const subject = extractHeader(headers, "Subject") ?? "";
  const toRaw = extractHeader(headers, "To") ?? "";
  const toEmails = toRaw.split(",").map((t) => parseEmailAddress(t.trim()).email);

  let bodyText = "";
  let bodyHtml = "";

  function extractBody(part: typeof payload.payload): void {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      bodyText += decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      bodyHtml += decodeBase64Url(part.body.data);
    }
    part.parts?.forEach(extractBody);
  }
  extractBody(payload.payload);

  if (!bodyText && bodyHtml) bodyText = stripHtml(bodyHtml);

  const headerMap: Record<string, string> = {};
  for (const h of headers) {
    if (h.name && h.value) headerMap[h.name] = h.value;
  }

  const receivedAt = payload.internalDate
    ? new Date(parseInt(payload.internalDate, 10)).toISOString()
    : new Date().toISOString();

  let { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("user_id", userId)
    .eq("gmail_thread_id", threadIdGmail)
    .maybeSingle();

  if (!thread) {
    const { data: newThread } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        gmail_thread_id: threadIdGmail,
        subject,
        participant_emails: [fromEmail, ...toEmails].filter(Boolean),
        message_count: 1,
        last_message_at: receivedAt,
      })
      .select("id")
      .single();
    thread = newThread!;
  } else {
    const { count } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", thread.id);

    await supabase
      .from("threads")
      .update({
        last_message_at: receivedAt,
        message_count: (count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id);
  }

  const isUnread = payload.labelIds?.includes("UNREAD") ?? false;
  const isSent = payload.labelIds?.includes("SENT") ?? false;
  const isInbox = payload.labelIds?.includes("INBOX") ?? false;

  const { data: email } = await supabase
    .from("emails")
    .insert({
      user_id: userId,
      thread_id: thread.id,
      gmail_message_id: messageId,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: toEmails,
      subject,
      snippet: payload.snippet ?? "",
      body_text: bodyText,
      body_html: bodyHtml || null,
      headers: headerMap,
      is_unread: isUnread,
      is_sent: isSent,
      is_inbox: isInbox,
      received_at: receivedAt,
    })
    .select("id")
    .single();

  if (!email) return;

  try {
    const classification = await classifyEmail(subject, bodyText, fromEmail);
    const validCategories = [
      "newsletter", "job", "finance", "notification", "personal", "work",
    ];
    const category = validCategories.includes(classification.category)
      ? (classification.category as EmailCategory)
      : "personal";

    await supabase
      .from("emails")
      .update({
        category,
        category_confidence: classification.confidence,
      })
      .eq("id", email.id);

    const summary = await summarizeEmail({
      subject,
      body_text: bodyText,
      from_email: fromEmail,
      from_name: fromName,
    });

    await supabase.from("emails").update({ summary }).eq("id", email.id);

    await embedEmailChunks(userId, email.id, thread.id, bodyText);

    const threadSummary = await summarizeThread(thread.id);
    await supabase
      .from("threads")
      .update({
        thread_summary: threadSummary,
        category,
        message_count: await countThreadMessages(thread.id),
      })
      .eq("id", thread.id);
  } catch (aiError) {
    console.error("AI processing failed for email", email.id, aiError);
  }
}

async function countThreadMessages(threadId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("thread_id", threadId);
  return count ?? 0;
}
