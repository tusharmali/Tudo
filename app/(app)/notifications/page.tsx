import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listForUser, markRead, getLastRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short" });
}
function fullTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [items, prevRead] = await Promise.all([listForUser(user.sub), getLastRead(user.sub)]);
  // Visiting the full list clears the unread badge (after capturing the boundary).
  await markRead(user.sub);

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Notifications</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Everything that pinged you — most recent first ({items.length}).</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="t">No notifications yet</div>
          <div className="s">You&apos;re all caught up.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {items.map((n) => {
            const unseen = (n.createdAt || "") > (prevRead || "");
            const inner = (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{n.title}</div>
                  {n.body && <div className="tiny muted" style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{n.body}</div>}
                </div>
                <div className="tiny faint" style={{ whiteSpace: "nowrap", flex: "none" }} title={fullTime(n.createdAt)}>
                  {timeAgo(n.createdAt)}
                </div>
              </>
            );
            const style = { display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", background: unseen ? "var(--accent-wash)" : undefined, color: "inherit", textDecoration: "none" } as const;
            return n.url ? (
              <Link key={n.id} href={n.url} style={style}>{inner}</Link>
            ) : (
              <div key={n.id} style={style}>{inner}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
