"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFunAction, setFunTitleAction, addContributionAction } from "@/app/actions/fun";
import { toast } from "@/components/Toaster";
import Avatar, { avatarSrc } from "@/components/Avatar";

type Contrib = { id: string; name: string; color: string; avatar: string; content: string };

export default function FunClient({
  enabled,
  title,
  isAdmin,
  contributions,
}: {
  enabled: boolean;
  title: string;
  isAdmin: boolean;
  contributions: Contrib[];
}) {
  const router = useRouter();
  const [t, setT] = useState(title);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const r = await toggleFunAction({ on: !enabled });
    if (r.ok) {
      toast(r.message || "Done");
      router.refresh();
    } else toast(r.error || "Error");
  }
  async function saveTitle() {
    const r = await setFunTitleAction({ title: t });
    if (r.ok) {
      toast(r.message || "Saved");
      router.refresh();
    } else toast(r.error || "Error");
  }
  async function add() {
    if (!content.trim()) {
      toast("Write something first");
      return;
    }
    setBusy(true);
    const r = await addContributionAction({ content });
    if (r.ok) {
      toast(r.message || "Posted");
      setContent("");
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row">
            <span className="spark" style={{ background: "linear-gradient(135deg,var(--peach),var(--blush))" }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.9 4.6L19 9l-4.6 1.9L12 15l-1.9-4.1L5 9Z" />
              </svg>
            </span>
            <div>
              <h3 className="sec">Fun Zone {enabled ? "is live!" : "is off"}</h3>
              <div className="tiny muted">{enabled ? `Now playing: ${title}` : "A super-admin can switch this on."}</div>
            </div>
          </div>
          {isAdmin && (
            <div className="row" style={{ gap: 8 }}>
              <span className="tiny faint">Enabled</span>
              <button className={`toggle${enabled ? " on" : ""}`} onClick={toggle} aria-label="Toggle Fun Zone" type="button" />
            </div>
          )}
        </div>
        {isAdmin && enabled && (
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <input className="inp" value={t} onChange={(e) => setT(e.target.value)} placeholder="Activity title" />
            <button className="btn btn-ghost" onClick={saveTitle} style={{ whiteSpace: "nowrap" }}>
              Save title
            </button>
          </div>
        )}
      </div>

      {!enabled ? (
        <div className="empty">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.9 4.6L19 9l-4.6 1.9L12 15l-1.9-4.1L5 9Z" />
          </svg>
          <div className="t">Fun Zone is currently off</div>
          <div className="s">{isAdmin ? "Flip the switch above to open it up." : "Check back when a super-admin turns it on."}</div>
        </div>
      ) : (
        <>
          <div className="grid g-2" style={{ marginBottom: 16 }}>
            {contributions.length === 0 && <p className="tiny faint">No entries yet — be the first!</p>}
            {contributions.map((c, i) => (
              <div className="contrib" key={i}>
                <div className="row" style={{ gap: 9 }}>
                  <Avatar name={c.name} color={c.color} src={avatarSrc(c)} size="sm" />
                  <b style={{ fontSize: 14 }}>{c.name}</b>
                </div>
                <div className="tiny" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {c.content}
                </div>
              </div>
            ))}
          </div>
          <div className="card pad">
            <label className="lbl">Your entry</label>
            <textarea
              className="inp"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your contribution…"
              style={{ minHeight: 80 }}
            />
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={add} disabled={busy}>
              {busy ? "Posting…" : "Post entry 🎉"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
