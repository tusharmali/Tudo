import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { chatViewFor } from "@/lib/chat-view";

/** Live conversation list + per-chat summary (unread, last message, mute).
 *  Returning the chat list too lets newly-added groups / new DMs appear
 *  without a page reload. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ overview: {}, chats: [] }, { status: 401 });
  const { chats, overview } = await chatViewFor(u);
  return NextResponse.json({ overview, chats });
}
