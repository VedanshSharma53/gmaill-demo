import { generateText } from "@/lib/ai/gemini";
import {
  SUMMARIZE_EMAIL_SYSTEM,
  SUMMARIZE_THREAD_SYSTEM,
} from "@/lib/ai/prompts";
import { createServiceClient } from "@/lib/supabase/server";
import type { Email } from "@/types";

export async function summarizeEmail(email: Pick<Email, "subject" | "body_text" | "from_email" | "from_name">): Promise<string> {
  const from = email.from_name
    ? `${email.from_name} <${email.from_email}>`
    : (email.from_email ?? "Unknown");

  const body = email.body_text?.slice(0, 8000) ?? "";
  const prompt = `From: ${from}\nSubject: ${email.subject ?? "(no subject)"}\n\n${body}`;

  return generateText(SUMMARIZE_EMAIL_SYSTEM, prompt);
}

export async function summarizeThread(threadId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data: emails } = await supabase
    .from("emails")
    .select("from_name, from_email, received_at, subject, body_text, summary")
    .eq("thread_id", threadId)
    .order("received_at", { ascending: true });

  if (!emails?.length) return "";

  const combined = emails
    .map((e, i) => {
      const sender = e.from_name ?? e.from_email ?? "Unknown";
      const date = e.received_at ?? "";
      const body = e.body_text?.slice(0, 3000) ?? e.summary ?? "";
      return `[Message ${i + 1}] From: ${sender} | ${date}\nSubject: ${e.subject ?? ""}\n${body}`;
    })
    .join("\n\n---\n\n");

  if (combined.length <= 24000) {
    return generateText(SUMMARIZE_THREAD_SYSTEM, combined);
  }

  const chunkSize = 5;
  const partialSummaries: string[] = [];
  for (let i = 0; i < emails.length; i += chunkSize) {
    const slice = emails.slice(i, i + chunkSize);
    const chunkText = slice
      .map((e, j) => {
        const sender = e.from_name ?? e.from_email ?? "Unknown";
        return `[Message ${i + j + 1}] From: ${sender} | ${e.received_at}\n${e.body_text?.slice(0, 2000) ?? ""}`;
      })
      .join("\n\n");
    partialSummaries.push(
      await generateText(SUMMARIZE_THREAD_SYSTEM, chunkText)
    );
  }

  return generateText(
    SUMMARIZE_THREAD_SYSTEM,
    partialSummaries.map((s, i) => `[Part ${i + 1}]\n${s}`).join("\n\n")
  );
}
