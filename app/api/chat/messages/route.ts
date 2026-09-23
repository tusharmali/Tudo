import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMember, getMessages, reactionsForMessageIds, markChatRead } from "@/lib/chat";

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId") || "";
  if (!chatId) return NextResponse.json({ messages: [], reactions: [] });

  if (!(await isMember(chatId, u.sub))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Full list each poll (chats are small) so reaction changes on older
  // messages propagate too. Viewing a chat marks it read.
  const messages = await getMessages(chatId);
  const reactions = await reactionsForMessageIds(messages.map((m) => m.id));
  await markChatRead(u.sub, chatId);
  return NextResponse.json({ messages, reactions });
}
