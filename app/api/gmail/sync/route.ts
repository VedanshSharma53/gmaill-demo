import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { runSyncBatch } from "@/lib/gmail/sync";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await request.json().catch(() => ({}));
    const jobType = body.job_type === "incremental" ? "incremental" : "full";

    const result = await runSyncBatch(user.id, jobType);

    if (!result.done) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Sync failed";
    return jsonError(message, 500);
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = createServiceClient();

    const { data: job } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: account } = await supabase
      .from("gmail_accounts")
      .select("sync_status, last_full_sync_at, last_history_id")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({ job, account });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("Failed to get sync status", 500);
  }
}
