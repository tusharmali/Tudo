import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { overviewFor } from "@/lib/chat";

/** Per-chat summary for the conversation list — last message, unread, mute. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ overview: {} }, { status: 401 });
  return NextResponse.json({ overview: await overviewFor(u.sub) });
}
