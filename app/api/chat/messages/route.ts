import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChat, chatAccess, getMessages, reactionsForMessageIds, markChatRead } from "@/lib/chat";

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId") || "";
  if (!chatId) return NextResponse.json({ messages: [], reactions: [], readOnly: false });

  const chat = await getChat(chatId);
  if (!chat) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = chatAccess(chat, u.sub);
  if (!access.member && !access.former) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Former members see history only up to when they left; current members, all.
  const messages = await getMessages(chatId, access.former ? { until: access.cutoff } : undefined);
  const reactions = await reactionsForMessageIds(messages.map((m) => m.id));
  if (access.member) await markChatRead(u.sub, chatId);
  return NextResponse.json({ messages, reactions, readOnly: access.former });
}
