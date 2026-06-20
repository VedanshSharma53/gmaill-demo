import { NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

async function getUserGmailAddress(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("gmail_accounts")
    .select("gmail_address")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.gmail_address?.toLowerCase() ?? null;
}

async function threadIdsForFolder(
  userId: string,
  folder: "inbox" | "sent"
): Promise<string[]> {
  const supabase = createServiceClient();
  const column = folder === "sent" ? "is_sent" : "is_inbox";

  const { data, error } = await supabase
    .from("emails")
    .select("thread_id")
    .eq("user_id", userId)
    .eq(column, true);

  if (!error) {
    return [...new Set((data ?? []).map((row) => row.thread_id))];
  }

  // Fallback if migration 002 not applied (column does not exist)
  const missingColumn =
    error.message.includes("is_sent") ||
    error.message.includes("is_inbox") ||
    error.code === "42703";

  if (!missingColumn) {
    throw new Error(error.message);
  }

  console.warn(
    `[threads] ${column} column missing — run supabase/migrations/002_email_folders.sql. Using from_email fallback.`
  );

  const userEmail = await getUserGmailAddress(userId);
  if (!userEmail) return [];

  const { data: emails, error: fallbackError } = await supabase
    .from("emails")
    .select("thread_id, from_email")
    .eq("user_id", userId);

  if (fallbackError) throw new Error(fallbackError.message);

  const threadIds = new Set<string>();

  for (const email of emails ?? []) {
    const from = email.from_email?.toLowerCase() ?? "";
    const isFromUser = from === userEmail;

    if (folder === "sent" && isFromUser) {
      threadIds.add(email.thread_id);
    } else if (folder === "inbox" && !isFromUser) {
      threadIds.add(email.thread_id);
    }
  }

  return [...threadIds];
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const threadId = searchParams.get("thread_id");
    const folder = searchParams.get("folder") === "sent" ? "sent" : "inbox";

    const supabase = createServiceClient();

    if (threadId) {
      const { data: thread } = await supabase
        .from("threads")
        .select("*")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .single();

      const { data: emails } = await supabase
        .from("emails")
        .select("*")
        .eq("thread_id", threadId)
        .order("received_at", { ascending: true });

      return NextResponse.json({ thread, emails: emails ?? [] });
    }

    const threadIds = await threadIdsForFolder(user.id, folder);

    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [] });
    }

    let query = supabase
      .from("threads")
      .select("*")
      .eq("user_id", user.id)
      .in("id", threadIds)
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.ilike("subject", `%${search}%`);
    }

    const { data: threads, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ threads: threads ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load threads";
    console.error("[threads]", message);
    return jsonError(message, 500);
  }
}
