import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { heartbeat, listOnlineIds } from "@/lib/presence";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * One call does both jobs: records the caller's heartbeat (they're online by
 * virtue of asking) and returns everyone currently online. The client polls it
 * on a gentle interval while the tab is visible.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ online: [], meId: "" }, { status: 401 });

  await heartbeat(me.sub);
  const ids = await listOnlineIds();
  ids.add(me.sub);

  const users = await listUsers();
  const online = users
    .filter((u) => ids.has(u.id))
    .map((u) => ({ id: u.id, name: u.name, color: u.avatarColor || "", avatar: u.avatar || "", dept: u.department || "" }));

  return NextResponse.json({ online, meId: me.sub });
}
