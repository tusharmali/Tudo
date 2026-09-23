"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConcernAction, replyConcernAction, resolveConcernAction } from "@/app/actions/concerns";
import { toast } from "@/components/Toaster";

export type ConcernRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  direction: "sent" | "received";
};
export type ReplyRow = { userId: string; userName: string; message: string };

function ThreadMsg({ name, text, mine }: { name: string; text: string; mine?: boolean }) {
  return (
    <div
      style={{
        padding: "10px 13px",
        borderRadius: 12,
        background: mine ? "var(--accent-wash)" : "var(--surface-2)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="tiny" style={{ fontWeight: 700, color: "var(--accent-ink)", marginBottom: 2 }}>
        {name}
      </div>
      <div className="tiny" style={{ whiteSpace: "pre-wrap" }}>
        {text}
      </div>
    </div>
  );
}

export default function ConcernsClient({
  me,
  concerns,
  repliesByConcern,
  recipients,
}: {
  me: string;
  concerns: ConcernRow[];
  repliesByConcern: Record<string, ReplyRow[]>;
  recipients: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [view, setView] = useState<string>(concerns.length ? concerns[0].id : "new");
  const [toId, setToId] = useState(recipients[0]?.id || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = concerns.find((c) => c.id === view) || null;

  async function send() {
    if (!subject.trim() || !message.trim()) {
      toast("Add a subject and a message");
      return;
    }
    setBusy(true);
    const r = await createConcernAction({ toUserId: toId, subject, message });
    if (r.ok) {
      toast(r.message || "Sent");
      setSubject("");
      setMessage("");
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  async function sendReply() {
    if (!reply.trim()) return;
    const r = await replyConcernAction({ concernId: view, message: reply });
    if (r.ok) {
      setReply("");
      router.refresh();
    } else toast(r.error || "Error");
  }

  async function toggleResolve() {
    if (!selected) return;
    const r = await resolveConcernAction({ concernId: selected.id, resolved: selected.status !== "resolved" });
    if (r.ok) {
      toast(r.message || "Done");
      router.refresh();
    } else toast(r.error || "Error");
  }

  return (
    <div className="split">
      <div className="card pad" style={{ alignSelf: "start" }}>
        <button className="btn btn-primary btn-block" onClick={() => setView("new")} style={{ marginBottom: 14 }}>
          + New concern
        </button>
        {concerns.length === 0 && <p className="tiny faint">No concerns yet.</p>}
        <div className="stack" style={{ gap: 8 }}>
          {concerns.map((c) => (
            <button
              key={c.id}
              onClick={() => setView(c.id)}
              className="task"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", margin: 0, borderColor: view === c.id ? "var(--accent)" : undefined }}
              type="button"
            >
              <div className="tbody">
                <div className="between">
                  <div className="t" style={{ fontSize: 13.5 }}>
                    {c.subject}
                  </div>
                  <span className={`pill ${c.status === "resolved" ? "p-good" : "p-warn"}`}>{c.status}</span>
                </div>
                <div className="sub">{c.direction === "sent" ? `To ${c.toName}` : `From ${c.fromName}`}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card pad">
        {view === "new" || !selected ? (
          <>
            <h3 className="sec" style={{ marginBottom: 14 }}>
              Raise a concern
            </h3>
            <label className="lbl">Send to</label>
            <select className="inp" value={toId} onChange={(e) => setToId(e.target.value)} style={{ marginBottom: 12 }}>
              {recipients.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
            <input className="inp" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 12 }} />
            <textarea
              className="inp"
              placeholder="Describe your concern — it stays private between you and the admin."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ minHeight: 130 }}
            />
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={send} disabled={busy}>
              {busy ? "Sending…" : "Send privately"}
            </button>
          </>
        ) : (
          <>
            <div className="between" style={{ marginBottom: 4 }}>
              <h3 className="sec">{selected.subject}</h3>
              <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={toggleResolve}>
                {selected.status === "resolved" ? "Reopen" : "Mark resolved"}
              </button>
            </div>
            <div className="tiny faint" style={{ marginBottom: 14 }}>
              {selected.direction === "sent" ? `To ${selected.toName}` : `From ${selected.fromName}`}
            </div>
            <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
              <ThreadMsg name={selected.fromName} text={selected.message} mine={selected.fromUserId === me} />
              {(repliesByConcern[selected.id] || []).map((r, i) => (
                <ThreadMsg key={i} name={r.userName} text={r.message} mine={r.userId === me} />
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="inp"
                placeholder="Write a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendReply();
                }}
              />
              <button className="btn btn-primary" onClick={sendReply}>
                Reply
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
