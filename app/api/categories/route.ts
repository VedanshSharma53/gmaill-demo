import { NextResponse } from "next/server";
import { requireSessionUser, jsonError } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { EMAIL_CATEGORIES } from "@/types";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const supabase = createServiceClient();

    const counts = await Promise.all(
      EMAIL_CATEGORIES.map(async (category) => {
        const { count } = await supabase
          .from("threads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("category", category);
        return { category, count: count ?? 0 };
      })
    );

    return NextResponse.json({ categories: counts });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("Failed to load categories", 500);
  }
}
