import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { overviewFor } from "@/lib/chat";
import { listRelated } from "@/lib/concerns";
import { listPending } from "@/lib/leave";
import { listUsers } from "@/lib/users";
import { isManager, manageDeptsOf, canManageDept } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Per-nav "needs your attention" counts, keyed by route. The Shell polls this
 * and renders a badge on the matching nav item (sidebar + bottom tabs).
 * Only non-zero counts are returned.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({}, { status: 401 });

  const out: Record<string, number> = {};

  // Unread chat messages across all my conversations.
  try {
    const ov = await overviewFor(me.sub);
    const chat = Object.values(ov).reduce((s, o) => s + (o?.unread || 0), 0);
    if (chat > 0) out["/chat"] = chat;
  } catch { /* non-fatal */ }

  // Concerns raised to me that are still open (awaiting my response).
  try {
    const concerns = await listRelated(me.sub);
    const open = concerns.filter((c) => c.toUserId === me.sub && c.status === "open").length;
    if (open > 0) out["/concerns"] = open;
  } catch { /* non-fatal */ }

  // Leave / WFH approvals waiting on me — managers see all, dept-admins only
  // their own team's.
  if (isManager(me.role) || manageDeptsOf(me).length > 0) {
    try {
      const pending = await listPending();
      let count = pending.length;
      if (!isManager(me.role)) {
        const deptById = new Map((await listUsers()).map((u) => [u.id, u.department || ""]));
        count = pending.filter((p) => canManageDept(me, deptById.get(p.userId) || "")).length;
      }
      if (count > 0) out["/attendance"] = count;
    } catch { /* non-fatal */ }
  }

  return NextResponse.json(out);
}
