"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPersonalTaskAction,
  togglePersonalTaskAction,
  removePersonalTaskAction,
  addBookmarkAction,
  removeBookmarkAction,
  saveNotesAction,
} from "@/app/actions/personal";
import { toast } from "@/components/Toaster";
import type { PersonalTask, Bookmark } from "@/lib/personal";

function Notepad({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onChange(v: string) {
    setText(v);
    dirty.current = true;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await saveNotesAction({ text: v });
      setStatus(r.ok ? "saved" : "idle");
      if (!r.ok) toast(r.error || "Couldn't save notes");
      else dirty.current = false;
    }, 800);
  }

  return (
    <div className="card pad" style={{ gridColumn: "1 / -1" }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <h3 className="sec" style={{ margin: 0 }}>Notepad</h3>
        <span className="tiny faint">{status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Autosaves as you type"}</span>
      </div>
      <textarea className="inp" style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.6 }} placeholder="Jot anything — meeting notes, ideas, to-remember…" value={text} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function fmtDue(due: string): string {
  const d = new Date(`${due}T00:00:00`);
  return isNaN(d.getTime()) ? due : d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function MyClient({ today, tasks, bookmarks, notes }: { today: string; tasks: PersonalTask[]; bookmarks: Bookmark[]; notes: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [addingT, setAddingT] = useState(false);
  const [busy, setBusy] = useState("");

  const [bt, setBt] = useState("");
  const [bu, setBu] = useState("");
  const [bn, setBn] = useState("");
  const [addingB, setAddingB] = useState(false);

  async function addTask() {
    if (!text.trim() || addingT) return;
    setAddingT(true);
    const r = await addPersonalTaskAction({ text, due });
    if (r.ok) {
      setText("");
      setDue("");
      router.refresh();
    } else toast(r.error || "Error");
    setAddingT(false);
  }
  async function toggle(t: PersonalTask) {
    setBusy(`t:${t.id}`);
    const r = await togglePersonalTaskAction({ id: t.id, done: t.done !== "true" });
    if (r.ok) router.refresh();
    else toast(r.error || "Error");
    setBusy("");
  }
  async function delTask(id: string) {
    setBusy(`t:${id}`);
    const r = await removePersonalTaskAction({ id });
    if (r.ok) router.refresh();
    else toast(r.error || "Error");
    setBusy("");
  }
  async function addBm() {
    if ((!bt.trim() && !bu.trim()) || addingB) return;
    setAddingB(true);
    const r = await addBookmarkAction({ title: bt, url: bu, note: bn });
    if (r.ok) {
      setBt("");
      setBu("");
      setBn("");
      router.refresh();
    } else toast(r.error || "Error");
    setAddingB(false);
  }
  async function delBm(id: string) {
    setBusy(`b:${id}`);
    const r = await removeBookmarkAction({ id });
    if (r.ok) router.refresh();
    else toast(r.error || "Error");
    setBusy("");
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>My Space</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Your own reminders and bookmarks — private to you, separate from assigned work.</p>
        </div>
      </div>

      <div className="grid g-2" style={{ alignItems: "start" }}>
        {/* Reminders */}
        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 12 }}>Reminders & to-dos</h3>
          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input className="inp" style={{ flex: 1, minWidth: 160 }} placeholder="Add a reminder…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />
            <input className="inp" type="date" style={{ width: 150 }} value={due} onChange={(e) => setDue(e.target.value)} title="Optional due date" />
            <button className="btn btn-primary" onClick={addTask} disabled={addingT || !text.trim()}>{addingT ? "Adding…" : "Add"}</button>
          </div>

          {tasks.length === 0 ? (
            <p className="tiny faint" style={{ marginTop: 10 }}>Nothing yet — add your first reminder above.</p>
          ) : (
            <div className="stack" style={{ gap: 6, marginTop: 8, maxHeight: "46vh", overflowY: "auto" }}>
              {tasks.map((t) => {
                const done = t.done === "true";
                const overdue = !done && t.due && t.due < today;
                return (
                  <div key={t.id} className="row" style={{ gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--line-soft)" }}>
                    <button type="button" className={`chk${done ? " on" : ""}`} onClick={() => toggle(t)} disabled={busy === `t:${t.id}`} title={done ? "Mark undone" : "Mark done"}>
                      {done ? "✓" : ""}
                    </button>
                    <span style={{ flex: 1, minWidth: 0, textDecoration: done ? "line-through" : "none", color: done ? "var(--ink-faint)" : "var(--ink)", fontSize: 13.5 }}>{t.text}</span>
                    {t.due && <span className={`pill ${overdue ? "p-bad" : "p-neut"}`} style={{ fontSize: 10.5 }}>{overdue ? "Overdue · " : ""}{fmtDue(t.due)}</span>}
                    <button type="button" className="mpick-x" onClick={() => delTask(t.id)} disabled={busy === `t:${t.id}`} title="Delete">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bookmarks */}
        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 12 }}>Bookmarks</h3>
          <div className="stack" style={{ gap: 8, marginBottom: 8 }}>
            <input className="inp" placeholder="Title (e.g. Design doc)" value={bt} onChange={(e) => setBt(e.target.value)} />
            <input className="inp" placeholder="https://…" value={bu} onChange={(e) => setBu(e.target.value)} />
            <div className="row" style={{ gap: 8 }}>
              <input className="inp" style={{ flex: 1 }} placeholder="Note (optional)" value={bn} onChange={(e) => setBn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBm(); }} />
              <button className="btn btn-primary" onClick={addBm} disabled={addingB || (!bt.trim() && !bu.trim())}>{addingB ? "Saving…" : "Save"}</button>
            </div>
          </div>

          {bookmarks.length === 0 ? (
            <p className="tiny faint" style={{ marginTop: 10 }}>No bookmarks yet — save links you want to keep handy.</p>
          ) : (
            <div className="stack" style={{ gap: 6, marginTop: 8, maxHeight: "46vh", overflowY: "auto" }}>
              {bookmarks.map((b) => (
                <div key={b.id} className="row" style={{ gap: 10, padding: "9px 4px", borderBottom: "1px solid var(--line-soft)", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {b.url ? (
                      <a href={b.url.startsWith("http") ? b.url : `https://${b.url}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 13.5, color: "var(--accent-ink)", textDecoration: "none" }}>
                        {b.title || hostOf(b.url)} ↗
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{b.title}</span>
                    )}
                    {b.url && <div className="tiny faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hostOf(b.url)}</div>}
                    {b.note && <div className="tiny muted" style={{ marginTop: 2 }}>{b.note}</div>}
                  </div>
                  <button type="button" className="mpick-x" onClick={() => delBm(b.id)} disabled={busy === `b:${b.id}`} title="Delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Notepad initial={notes} />
      </div>
    </>
  );
}
