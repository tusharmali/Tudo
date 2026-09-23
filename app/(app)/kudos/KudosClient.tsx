"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { giveKudosAction, deleteKudoAction } from "@/app/actions/kudos";
import { toast } from "@/components/Toaster";

type Cat = { key: string; label: string; emoji: string };
type FeedItem = { id: string; fromUserId: string; fromName: string; toName: string; emoji: string; label: string; message: string; when: string };
type Leader = { name: string; color: string; count: number };

function initials(n: string): string {
  return n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function KudosClient({
  me,
  canModerate,
  recipients,
  feed,
  leaderboard,
  categories,
}: {
  me: string;
  canModerate: boolean;
  recipients: { id: string; name: string }[];
  feed: FeedItem[];
  leaderboard: Leader[];
  categories: Cat[];
}) {
  const router = useRouter();
  const [to, setTo] = useState(recipients[0]?.id || "");
  const [cat, setCat] = useState(categories[0]?.key || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function removeKudo(id: string) {
    if (!confirm("Remove this kudo?")) return;
    setRemoving(id);
    const r = await deleteKudoAction({ id });
    if (r.ok) {
      toast(r.message || "Removed");
      router.refresh();
    } else toast(r.error || "Error");
    setRemoving(null);
  }

  async function send() {
    if (!to) {
      toast("Pick a teammate");
      return;
    }
    if (!msg.trim()) {
      toast("Add a short message");
      return;
    }
    setBusy(true);
    const r = await giveKudosAction({ toUserId: to, category: cat, message: msg });
    if (r.ok) {
      toast(r.message || "Sent 🎉");
      setMsg("");
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <div className="grid g-2-1">
      <div className="stack">
        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 4 }}>
            Give kudos 🎉
          </h3>
          <p className="muted tiny" style={{ margin: "0 0 14px" }}>
            Recognize a teammate who made your day better.
          </p>
          <label className="lbl">To</label>
          <select className="inp" value={to} onChange={(e) => setTo(e.target.value)} style={{ marginBottom: 12 }}>
            {recipients.length === 0 && <option value="">No teammates yet</option>}
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <label className="lbl">For</label>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                className="chip"
                style={cat === c.key ? { borderColor: "var(--accent)", background: "var(--accent-wash)", color: "var(--accent-ink)" } : undefined}
                onClick={() => setCat(c.key)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <textarea
            className="inp"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. Saved the release with a last-minute fix — legend!"
            style={{ minHeight: 82 }}
          />
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send kudos"}
          </button>
        </div>

        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 12 }}>
            Recent shout-outs
          </h3>
          {feed.length === 0 && <p className="tiny faint">No kudos yet — be the first to appreciate someone!</p>}
          <div className="stack" style={{ gap: 12 }}>
            {feed.map((k) => (
              <div
                key={k.id}
                style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--line)" }}
              >
                <div style={{ fontSize: 24, width: 42, height: 42, borderRadius: 12, background: "var(--surface-3)", display: "grid", placeItems: "center", flex: "none" }}>
                  {k.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny">
                    <b>{k.fromName}</b> → <b>{k.toName}</b>
                    <span className="pill p-peri" style={{ marginLeft: 6 }}>
                      {k.label}
                    </span>
                  </div>
                  <div className="tiny" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {k.message}
                  </div>
                  <div className="tiny faint" style={{ marginTop: 4 }}>
                    {k.when}
                  </div>
                </div>
                {(canModerate || k.fromUserId === me) && (
                  <button
                    className="icon-btn"
                    style={{ width: 28, height: 28, flex: "none" }}
                    title={k.fromUserId === me ? "Remove (you gave this)" : "Remove kudo"}
                    onClick={() => removeKudo(k.id)}
                    disabled={removing === k.id}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card pad" style={{ alignSelf: "start" }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>
          Most appreciated 🏆
        </h3>
        {leaderboard.length === 0 ? (
          <p className="tiny faint">No kudos yet.</p>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {leaderboard.map((l, i) => (
              <div className="row" key={i} style={{ gap: 10 }}>
                <span className="tiny faint num" style={{ width: 16 }}>
                  {i + 1}
                </span>
                <div className="avatar sm" style={{ background: l.color }}>
                  {initials(l.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>{l.name}</div>
                <span className="pill p-good num">{l.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
