"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { moveTaskAction, addBoardTaskAction, deleteBoardTaskAction, carryOverAction } from "@/app/actions/board";
import { toast } from "@/components/Toaster";
import Avatar, { avatarSrc } from "@/components/Avatar";
import type { TaskNode } from "@/lib/tasks";

type Col = "backlog" | "todo" | "doing" | "done";
type Cols = Record<Col, TaskNode[]>;
type TeamRow = { id: string; name: string; dept: string; avatar: string; color: string; backlog: number; todo: number; doing: number; done: number; doingTitles: string[] };

const COLS: { key: Col; label: string; hint: string }[] = [
  { key: "backlog", label: "Backlog", hint: "everything queued" },
  { key: "todo", label: "Today", hint: "day targets" },
  { key: "doing", label: "In progress", hint: "working on now" },
  { key: "done", label: "Done", hint: "finished today" },
];

export default function BoardClient({
  cols: initial, viewUser, isSelf, canEdit, team, date, viewerIsPlanner,
}: {
  cols: Cols;
  viewUser: { id: string; name: string; avatar: string; color: string };
  isSelf: boolean;
  canEdit: boolean;
  team: TeamRow[];
  date: string;
  viewerIsPlanner: boolean;
}) {
  const router = useRouter();
  const [cols, setCols] = useState<Cols>(initial);
  const busyRef = useRef(0);
  const lastSig = useRef("");
  const [dragId, setDragId] = useState("");
  const dragFrom = useRef<Col | null>(null);
  const [over, setOver] = useState<Col | "">("");
  const [add, setAdd] = useState<Record<string, string>>({ backlog: "", todo: "" });

  const sig = useMemo(() => (c: Cols) => (Object.keys(c) as Col[]).map((k) => c[k].map((t) => t.id + t.status + t.date).join(",")).join("|"), []);
  useEffect(() => {
    const incoming = sig(initial);
    if (incoming !== lastSig.current && busyRef.current === 0 && !dragId) { setCols(initial); lastSig.current = incoming; }
  }, [initial, sig, dragId]);

  function findCard(id: string): { col: Col; card: TaskNode } | null {
    for (const k of Object.keys(cols) as Col[]) { const card = cols[k].find((t) => t.id === id); if (card) return { col: k, card }; }
    return null;
  }

  async function drop(to: Col) {
    const id = dragId;
    setOver(""); setDragId(""); dragFrom.current = null;
    if (!id) return;
    const found = findCard(id);
    if (!found || found.col === to) return;
    const snapshot = cols;
    setCols((prev) => {
      const next: Cols = { backlog: [...prev.backlog], todo: [...prev.todo], doing: [...prev.doing], done: [...prev.done] };
      const card = next[found.col].find((t) => t.id === id);
      next[found.col] = next[found.col].filter((t) => t.id !== id);
      if (card) next[to] = [...next[to], { ...card }];
      return next;
    });
    busyRef.current++;
    try {
      const r = await moveTaskAction({ id, to, date });
      if (!r.ok) { setCols(snapshot); toast(r.error || "Couldn't move"); }
    } finally { busyRef.current--; }
  }

  async function addTo(col: "backlog" | "todo") {
    const content = (add[col] || "").trim();
    if (!content) return;
    const tmp = "tmp_" + Math.random().toString(36).slice(2);
    setAdd((a) => ({ ...a, [col]: "" }));
    setCols((prev) => ({ ...prev, [col]: [...prev[col], { id: tmp, userId: viewUser.id, date, parentId: "", content, order: "999", status: "pending", updateText: "", children: [] }] }));
    busyRef.current++;
    try {
      const r = await addBoardTaskAction({ content, column: col, forUserId: isSelf ? undefined : viewUser.id, date });
      if (r.ok && r.data) setCols((prev) => ({ ...prev, [col]: prev[col].map((t) => (t.id === tmp ? { ...t, id: r.data! } : t)) }));
      else { setCols((prev) => ({ ...prev, [col]: prev[col].filter((t) => t.id !== tmp) })); toast(r.error || "Couldn't add"); }
    } finally { busyRef.current--; }
  }

  async function del(id: string) {
    const snapshot = cols;
    setCols((prev) => { const n = { ...prev } as Cols; for (const k of Object.keys(n) as Col[]) n[k] = n[k].filter((t) => t.id !== id); return n; });
    busyRef.current++;
    try { const r = await deleteBoardTaskAction({ id }); if (!r.ok) { setCols(snapshot); toast(r.error || "Error"); } }
    finally { busyRef.current--; }
  }

  async function carry() {
    if (!window.confirm("Move today's unfinished tasks to tomorrow?")) return;
    const r = await carryOverAction({ date, forUserId: isSelf ? undefined : viewUser.id });
    if (r.ok) { toast(r.message || "Carried over"); lastSig.current = ""; router.refresh(); } else toast(r.error || "Nothing to carry");
  }

  const count = (c: Col) => cols[c].length;

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          {!isSelf && <Avatar name={viewUser.name} color={viewUser.color} src={avatarSrc(viewUser)} size="sm" />}
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>{isSelf ? "My board" : `${viewUser.name}'s board`}</h2>
            <p className="muted tiny" style={{ margin: "2px 0 0" }}>Drag cards between columns. Pull from Backlog into Today as your day targets.</p>
          </div>
        </div>
        {canEdit && <button className="btn btn-ghost" type="button" onClick={carry} style={{ padding: "8px 13px", fontSize: 12.5 }} title="Push unfinished tasks to tomorrow">↪ Carry unfinished to tomorrow</button>}
      </div>

      <div className="board-grid">
        {COLS.map((c) => (
          <div
            key={c.key}
            className={`board-col${over === c.key ? " over" : ""}`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(c.key); } }}
            onDragLeave={() => setOver((o) => (o === c.key ? "" : o))}
            onDrop={() => drop(c.key)}
          >
            <div className="board-col-head">
              <span className={`board-dot ${c.key}`} /> {c.label}
              <span className="board-count">{count(c.key)}</span>
            </div>
            <div className="board-cards">
              {cols[c.key].length === 0 && <div className="board-empty">{c.key === "backlog" ? "Queue tasks here" : c.key === "todo" ? "Nothing planned" : "—"}</div>}
              {cols[c.key].map((t) => (
                <div
                  key={t.id}
                  className={`board-card${dragId === t.id ? " dragging" : ""}`}
                  draggable={canEdit && !t.id.startsWith("tmp_")}
                  onDragStart={(e) => { if (!canEdit) return; setDragId(t.id); dragFrom.current = c.key; try { e.dataTransfer.setData("text/plain", t.id); } catch { /* */ } }}
                  onDragEnd={() => { setDragId(""); setOver(""); }}
                >
                  <div className="board-card-top">
                    <span className={`board-card-text${c.key === "done" ? " done" : ""}`}>{t.content}</span>
                    {canEdit && <button className="board-x" type="button" title="Remove" onClick={() => del(t.id)}>✕</button>}
                  </div>
                  {t.children.length > 0 && (
                    <ul className="board-subs">
                      {t.children.slice(0, 4).map((k) => <li key={k.id}>{k.content}</li>)}
                      {t.children.length > 4 && <li className="faint">+{t.children.length - 4} more</li>}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (c.key === "backlog" || c.key === "todo") && (
              <form className="board-add" onSubmit={(e) => { e.preventDefault(); addTo(c.key as "backlog" | "todo"); }}>
                <input className="inp" placeholder={c.key === "backlog" ? "Add to backlog…" : "Add a day target…"} value={add[c.key] || ""} onChange={(e) => setAdd((a) => ({ ...a, [c.key]: e.target.value }))} style={{ padding: "7px 9px", fontSize: 12.5 }} />
              </form>
            )}
          </div>
        ))}
      </div>

      {viewerIsPlanner && team.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="between" style={{ padding: "16px 20px 6px" }}>
            <h3 className="sec">Team · today</h3>
            <span className="tiny faint">who&apos;s working on what</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Member</th><th>Backlog</th><th>Today</th><th>Doing</th><th>Done</th><th>In progress now</th><th></th></tr></thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td><div className="row"><Avatar name={m.name} color={m.color} src={avatarSrc({ id: m.id, avatar: m.avatar })} size="sm" />{m.name}</div></td>
                    <td className="num">{m.backlog || "—"}</td>
                    <td className="num">{m.todo || "—"}</td>
                    <td className="num"><span className={m.doing ? "pill p-warn" : ""} style={{ fontSize: 11 }}>{m.doing || "—"}</span></td>
                    <td className="num">{m.done || "—"}</td>
                    <td className="tiny muted" style={{ maxWidth: 260 }}>{m.doingTitles.slice(0, 2).join(" · ") || "—"}</td>
                    <td><Link className="chip" href={`/board?u=${m.id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
