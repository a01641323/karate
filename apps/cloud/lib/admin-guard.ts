import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Every admin API route should call this first.
export async function requireSuperadmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
