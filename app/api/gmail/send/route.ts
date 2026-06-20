import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { getGmailClient } from "@/lib/gmail/client";
import { buildRawMimeMessage, extractHeader } from "@/lib/gmail/mime";
import { withGmailBackoff } from "@/lib/gmail/backoff";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const { to, subject, text, reply_to_email_id, thread_id } = body;

    if (!to || !subject || !text) {
      return jsonError("Missing required fields: to, subject, text");
    }

    const gmail = await getGmailClient(user.id);
    const supabase = createServiceClient();

    let inReplyTo: string | undefined;
    let references: string | undefined;
    let gmailThreadId: string | undefined;

    if (reply_to_email_id) {
      const { data: parentEmail } = await supabase
        .from("emails")
        .select("gmail_message_id, headers, thread_id")
        .eq("id", reply_to_email_id)
        .eq("user_id", user.id)
        .single();

      if (parentEmail) {
        const parentMsg = await withGmailBackoff(() =>
          gmail.users.messages.get({
            userId: "me",
            id: parentEmail.gmail_message_id,
            format: "metadata",
            metadataHeaders: ["Message-Id", "References"],
          })
        );

        const headers = parentMsg.data.payload?.headers;
        const messageId = extractHeader(headers, "Message-Id");
        const parentRefs = extractHeader(headers, "References");

        if (messageId) {
          inReplyTo = messageId;
          references = parentRefs ? `${parentRefs} ${messageId}` : messageId;
        }

        const { data: thread } = await supabase
          .from("threads")
          .select("gmail_thread_id")
          .eq("id", parentEmail.thread_id)
          .single();

        gmailThreadId = thread?.gmail_thread_id;
      }
    } else if (thread_id) {
      const { data: thread } = await supabase
        .from("threads")
        .select("gmail_thread_id")
        .eq("id", thread_id)
        .eq("user_id", user.id)
        .single();
      gmailThreadId = thread?.gmail_thread_id;
    }

    const raw = buildRawMimeMessage({
      from: user.email,
      to,
      subject,
      text,
      inReplyTo,
      references,
    });

    const sendBody: { raw: string; threadId?: string } = { raw };
    if (gmailThreadId) sendBody.threadId = gmailThreadId;

    await withGmailBackoff(() =>
      gmail.users.messages.send({ userId: "me", requestBody: sendBody })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Send failed";
    return jsonError(message, 500);
  }
}
