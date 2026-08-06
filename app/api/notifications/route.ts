import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listForUser, getLastRead } from "@/lib/notifications";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });

  const [items, lastRead] = await Promise.all([listForUser(u.sub), getLastRead(u.sub)]);
  const unread = items.filter((n) => (n.createdAt || "") > (lastRead || "")).length;
  return NextResponse.json({ items: items.slice(0, 20), unread });
}
