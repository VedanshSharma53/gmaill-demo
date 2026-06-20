import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { generateText } from "@/lib/ai/gemini";
import { COMPOSE_SYSTEM, REPLY_SYSTEM } from "@/lib/ai/prompts";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const { prompt, thread_id, reply_to_email_id } = await request.json();

    if (!prompt?.trim()) {
      return jsonError("Prompt is required");
    }

    const supabase = createServiceClient();

    if (thread_id || reply_to_email_id) {
      let threadId = thread_id;

      if (reply_to_email_id && !threadId) {
        const { data: email } = await supabase
          .from("emails")
          .select("thread_id")
          .eq("id", reply_to_email_id)
          .single();
        threadId = email?.thread_id;
      }

      if (!threadId) return jsonError("Thread not found");

      const { data: emails } = await supabase
        .from("emails")
        .select("id, from_name, from_email, received_at, subject, body_text, summary")
        .eq("thread_id", threadId)
        .order("received_at", { ascending: true });

      const threadContext = (emails ?? [])
        .map((e, i) => {
          const sender = e.from_name ?? e.from_email ?? "Unknown";
          const body = e.summary ?? e.body_text?.slice(0, 1500) ?? "";
          return `[${i + 1}] ${sender} (${e.received_at}):\n${body}`;
        })
        .join("\n\n");

      const draft = await generateText(
        REPLY_SYSTEM,
        `Thread context:\n${threadContext}\n\nUser request: ${prompt}`
      );

      const lastEmail = emails?.[emails.length - 1];
      return NextResponse.json({
        draft,
        to: lastEmail?.from_email ?? "",
        subject: lastEmail?.subject?.startsWith("Re:")
          ? lastEmail.subject
          : `Re: ${lastEmail?.subject ?? ""}`,
        reply_to_email_id: reply_to_email_id ?? lastEmail?.id,
        thread_id: threadId,
      });
    }

    const draft = await generateText(COMPOSE_SYSTEM, prompt);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Compose failed";
    return jsonError(message, 500);
  }
}
