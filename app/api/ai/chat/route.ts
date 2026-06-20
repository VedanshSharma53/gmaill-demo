import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { runRagQuery } from "@/lib/ai/rag";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const { question, session_id } = await request.json();

    if (!question?.trim()) {
      return jsonError("Question is required");
    }

    const supabase = createServiceClient();
    let sessionId = session_id;

    if (!sessionId) {
      const { data: session } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: question.slice(0, 80),
        })
        .select("id")
        .single();
      sessionId = session?.id;
    }

    if (!sessionId) return jsonError("Failed to create chat session", 500);

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: question,
    });

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10);

    const conversationHistory = (history ?? []).slice(0, -1);

    const result = await runRagQuery(user.id, question, conversationHistory);

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: result.answer,
      citations: result.citations,
    });

    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({
      session_id: sessionId,
      answer: result.answer,
      citations: result.citations,
      sufficient: result.sufficient,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Chat failed";
    return jsonError(message, 500);
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = createServiceClient();

    const { data: sessions } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("Failed to load sessions", 500);
  }
}
