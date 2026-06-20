import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!session) return jsonError("Session not found", 404);

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ session, messages: messages ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("Failed to load messages", 500);
  }
}
