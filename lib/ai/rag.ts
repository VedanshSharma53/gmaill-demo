import { embedQuery } from "@/lib/ai/nim";
import { generateStructuredChatResponse } from "@/lib/ai/gemini";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { RAG_TOP_K } from "@/lib/ai/models";
import { createServiceClient } from "@/lib/supabase/server";
import type { Citation } from "@/types";

interface RetrievedChunk {
  id: string;
  email_id: string;
  thread_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
}

export async function retrieveChunks(
  userId: string,
  query: string,
  topK = RAG_TOP_K
): Promise<RetrievedChunk[]> {
  const supabase = createServiceClient();
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc("match_email_chunks", {
    query_embedding: queryEmbedding,
    match_user_id: userId,
    match_count: topK,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as RetrievedChunk[];
}

export async function enrichChunksWithMetadata(
  chunks: RetrievedChunk[]
): Promise<Array<RetrievedChunk & { sender: string; subject: string; date: string; snippet: string }>> {
  if (!chunks.length) return [];

  const supabase = createServiceClient();
  const emailIds = [...new Set(chunks.map((c) => c.email_id))];

  const { data: emails } = await supabase
    .from("emails")
    .select("id, from_name, from_email, subject, received_at, snippet")
    .in("id", emailIds);

  const emailMap = new Map(emails?.map((e) => [e.id, e]) ?? []);

  return chunks.map((chunk) => {
    const email = emailMap.get(chunk.email_id);
    const sender = email?.from_name ?? email?.from_email ?? "Unknown";
    return {
      ...chunk,
      sender,
      subject: email?.subject ?? "(no subject)",
      date: email?.received_at ?? "",
      snippet: email?.snippet ?? chunk.chunk_text.slice(0, 120),
    };
  });
}

export async function runRagQuery(
  userId: string,
  question: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ answer: string; citations: Citation[]; sufficient: boolean }> {
  const chunks = await retrieveChunks(userId, question);
  const enriched = await enrichChunksWithMetadata(chunks);

  if (!enriched.length) {
    return {
      answer: "I couldn't find anything about that in your emails.",
      citations: [],
      sufficient: false,
    };
  }

  const tagMap = new Map<string, Citation>();
  const excerptLines = enriched.map((chunk, i) => {
    const tag = `E${i + 1}`;
    tagMap.set(tag, {
      email_id: chunk.email_id,
      thread_id: chunk.thread_id,
      sender: chunk.sender,
      subject: chunk.subject,
      date: chunk.date,
      snippet: chunk.snippet,
      tag,
    });

    return `[${tag}] From: ${chunk.sender} | ${chunk.date} | Subject: ${chunk.subject}\n${chunk.chunk_text}`;
  });

  const historyText = conversationHistory
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const systemPrompt = buildChatSystemPrompt(excerptLines.join("\n\n"));
  const userPrompt = historyText
    ? `Conversation so far:\n${historyText}\n\nQuestion: ${question}`
    : `Question: ${question}`;

  const response = await generateStructuredChatResponse(systemPrompt, userPrompt);

  if (!response.sufficient_context) {
    return {
      answer: "I couldn't find anything about that in your emails.",
      citations: [],
      sufficient: false,
    };
  }

  const citations = response.citation_tags
    .map((tag) => tagMap.get(tag.replace(/[\[\]]/g, "")) ?? tagMap.get(tag))
    .filter((c): c is Citation => !!c);

  const uniqueCitations = [
    ...new Map(citations.map((c) => [c.email_id, c])).values(),
  ];

  return {
    answer: response.answer,
    citations: uniqueCitations,
    sufficient: true,
  };
}

export async function embedEmailChunks(
  userId: string,
  emailId: string,
  threadId: string,
  bodyText: string
): Promise<void> {
  const { chunkText } = await import("@/lib/ai/chunking");
  const { embedPassage } = await import("@/lib/ai/nim");
  const supabase = createServiceClient();

  const chunks = chunkText(bodyText);
  if (!chunks.length) return;

  await supabase.from("email_chunks").delete().eq("email_id", emailId);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await embedPassage(chunks[i]);
      await supabase.from("email_chunks").insert({
        email_id: emailId,
        thread_id: threadId,
        user_id: userId,
        chunk_index: i,
        chunk_text: chunks[i],
        embedding,
      });
    } catch (err) {
      console.warn(`[embed] skipped chunk ${i} for email ${emailId}:`, err);
    }
  }
}
