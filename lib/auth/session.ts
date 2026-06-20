import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) {
    return null;
  }
  return {
    id: session.user.id as string,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
