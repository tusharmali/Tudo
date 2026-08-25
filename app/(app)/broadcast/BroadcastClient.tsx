"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pushBroadcastAction, deleteNotificationAction, clearAllNotificationsAction } from "@/app/actions/notifications";
import { toast } from "@/components/Toaster";
import PushToggle from "@/components/PushToggle";

type Recent = { id: string; title: string; body: string; when: string };

export default function BroadcastClient({ recent }: { recent: Recent[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Recent[]>(recent);
  const [removing, setRemoving] = useState<string | null>(null);

  // Keep the local list in sync when the server re-renders (after a push).
  useEffect(() => {
    setList(recent);
  }, [recent]);

  async function remove(id: string) {
    setRemoving(id);
    const prev = list;
    setList((l) => l.filter((n) => n.id !== id)); // optimistic
    const r = await deleteNotificationAction({ id });
    if (r.ok) {
      toast(r.message || "Deleted");
      if (typeof window !== "undefined") window.dispatchEvent(new Event("tudo:notify-refresh"));
      router.refresh();
    } else {
      setList(prev); // roll back
      toast(r.error || "Couldn't delete");
    }
    setRemoving(null);
  }

  async function clearAll() {
    if (!list.length) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete all ${list.length} notifications? This can't be undone.`)) return;
    const prev = list;
    setList([]); // optimistic
    const r = await clearAllNotificationsAction();
    if (r.ok) {
      toast(r.message || "Cleared");
      if (typeof window !== "undefined") window.dispatchEvent(new Event("tudo:notify-refresh"));
      router.refresh();
    } else {
      setList(prev);
      toast(r.error || "Couldn't clear");
    }
  }

  async function push() {
    if (!title.trim() && !body.trim()) {
      toast("Add a title or a message");
      return;
    }
    setBusy(true);
    const r = await pushBroadcastAction({ title, body });
    if (r.ok) {
      toast(r.message || "Sent");
      setTitle("");
      setBody("");
      if (typeof window !== "undefined") window.dispatchEvent(new Event("tudo:notify-refresh"));
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 className="sec">Broadcast to everyone</h3>
          <span className="pill p-peri">Super Admin</span>
        </div>
        <p className="muted tiny" style={{ margin: "0 0 16px" }}>
          Appears on every teammate&apos;s dashboard bell within seconds, and pushes to the phones of anyone who enabled notifications.
        </p>
        <input className="inp" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
        <textarea className="inp" placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 110 }} />
        <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={push} disabled={busy}>
            {busy ? "Sending…" : "Push to all"}
          </button>
          <PushToggle />
        </div>
      </div>

      <div className="stack">
        <div>
          <div className="tiny faint" style={{ fontWeight: 600, marginBottom: 8, letterSpacing: ".04em", textTransform: "uppercase" }}>
            Phone preview
          </div>
          <div className="push-preview">
            <div className="pi">T</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Tudo{title ? ` · ${title}` : ""}</div>
              <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>{body || "Your message will show here."}</div>
            </div>
          </div>
        </div>
        <div className="card pad">
          <div className="between" style={{ marginBottom: 12 }}>
            <h3 className="sec" style={{ margin: 0 }}>
              Recent broadcasts
            </h3>
            {list.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>
          {list.length === 0 && <p className="tiny faint">Nothing sent yet.</p>}
          {list.map((n) => (
            <div className="notif" key={n.id} style={{ opacity: removing === n.id ? 0.5 : 1 }}>
              <div className="ni tint-peri">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</div>
                {n.body && <div className="tiny muted">{n.body}</div>}
                <div className="tiny faint">{n.when}</div>
              </div>
              <button
                className="icon-btn"
                style={{ width: 30, height: 30, flex: "none" }}
                title="Delete notification"
                onClick={() => remove(n.id)}
                disabled={removing === n.id}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
