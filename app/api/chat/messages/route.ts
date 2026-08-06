import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMember, getMessages } from "@/lib/chat";

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId") || "";
  const since = searchParams.get("since") || undefined;
  if (!chatId) return NextResponse.json({ messages: [] });

  if (!(await isMember(chatId, u.sub))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const messages = await getMessages(chatId, since);
  return NextResponse.json({ messages });
}
