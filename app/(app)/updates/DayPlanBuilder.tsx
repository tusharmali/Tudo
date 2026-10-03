"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTaskAction, deleteTaskAction, setTaskContentAction, reorderTasksAction,
  resetDayAction, setWeekTargetAction, setFooterAction, copyPreviousDayPlanAction,
} from "@/app/actions/updates";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";
import { renderDayPlan } from "@/lib/format";
import type { TaskNode } from "@/lib/tasks";

export type BuilderUser = { id: string; name: string; handle: string; department: string };
type Node = TaskNode;
type TaskMap = Record<string, Node[]>;

const isTemp = (id: string) => id.startsWith("tmp_");

// ---- immutable tree helpers (operate on one user's node list) ----
function withUser(map: TaskMap, uid: string, fn: (ns: Node[]) => Node[]): TaskMap {
  return { ...map, [uid]: fn(map[uid] || []) };
}
function moveBefore<T extends { id: string }>(arr: T[], dragId: string, targetId: string): T[] {
  const from = arr.findIndex((x) => x.id === dragId);
  const to = arr.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0 || from === to) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
function groupIds(nodes: Node[], parentId: string): string[] {
  if (!parentId) return nodes.map((n) => n.id);
  return (nodes.find((n) => n.id === parentId)?.children || []).map((c) => c.id);
}

/** A task text field — edits locally, saves on blur / Enter. */
function TaskInput({ id, content, child = false, onSave }: { id: string; content: string; child?: boolean; onSave: (id: string, content: string) => Promise<boolean> }) {
  const [v, setV] = useState(content);
  const [saving, setSaving] = useState(false);
  useEffect(() => setV(content), [content]);
  async function commit() {
    const next = v.trim();
    if (!next || next === content.trim()) { setV(content); return; }
    setSaving(true);
    const ok = await onSave(id, next);
    if (!ok) setV(content);
    setSaving(false);
  }
  return (
    <input
      className={`dp-edit${child ? " child" : ""}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      disabled={saving || isTemp(id)}
      aria-label="Task text"
    />
  );
}

export default function DayPlanBuilder({
  users, tasksByUser, weekTargets, footer, date, canEditFooter = true,
}: {
  users: BuilderUser[];
  tasksByUser: TaskMap;
  weekTargets: Record<string, string>;
  footer: string;
  dayPlanText?: string;
  date: string;
  canEditFooter?: boolean;
}) {
  const router = useRouter();
  const departments = useMemo(() => [...new Set(users.map((u) => u.department).filter(Boolean))].sort(), [users]);
  const [dept, setDept] = useState("all");
  const scoped = useMemo(() => users.filter((u) => dept === "all" || u.department === dept), [users, dept]);

  const [sel, setSel] = useState(users[0]?.id || "");
  const [wt, setWt] = useState(weekTargets[sel] || "");
  const [ft, setFt] = useState(footer);
  const [newTask, setNewTask] = useState("");
  const [parentId, setParentId] = useState("");
  const [busyCopy, setBusyCopy] = useState(false);
  const [busyReset, setBusyReset] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Local, optimistic copy of the tasks so edits appear instantly. Re-seeded from
  // the server only while idle (no in-flight op / drag), so background refreshes
  // merge others' changes without clobbering what you're doing.
  const [byUser, setByUser] = useState<TaskMap>(tasksByUser);
  const busyRef = useRef(0);
  const draggingRef = useRef(false);
  const lastSig = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sigOf = (m: TaskMap) => Object.keys(m).sort().map((uid) =>
    (m[uid] || []).map((n) => `${n.id}:${n.content}[${n.children.map((c) => c.id + ":" + c.content).join(",")}]`).join("|")
  ).join("||");

  useEffect(() => {
    const incoming = sigOf(tasksByUser);
    if (incoming !== lastSig.current && busyRef.current === 0 && !draggingRef.current) {
      setByUser(tasksByUser);
      lastSig.current = incoming;
    }
  }, [tasksByUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the selected teammate inside the current department scope.
  useEffect(() => {
    if (!scoped.some((u) => u.id === sel)) setSel(scoped[0]?.id || "");
  }, [scoped, sel]);
  useEffect(() => { setWt(weekTargets[sel] || ""); }, [sel, weekTargets]);
  useEffect(() => { setParentId(""); }, [sel]); // reset add-target only when switching teammate

  const nodes = byUser[sel] || [];
  const selName = users.find((u) => u.id === sel)?.name || "this teammate";
  const parentOptions = nodes.filter((n) => !isTemp(n.id));

  const candidates = scoped.filter((u) => (byUser[u.id]?.length || 0) > 0);
  const shown = candidates.filter((u) => !hidden.has(u.id));
  const planText = renderDayPlan(
    date,
    shown.map((u) => ({ handle: u.handle, nodes: byUser[u.id] || [], weekTarget: weekTargets[u.id] || "" })),
    ft,
  );

  function toggleHidden(id: string) {
    setHidden((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  // ---- task ops (optimistic) ----
  async function addTask() {
    const content = newTask.trim();
    if (!content) return toast("Type the task first");
    if (!sel) return;
    const pid = parentId;
    const tmpId = "tmp_" + Math.random().toString(36).slice(2);
    const base = { userId: sel, date, order: "999", status: "pending", updateText: "" };
    busyRef.current++;
    setByUser((prev) => withUser(prev, sel, (ns) =>
      pid
        ? ns.map((n) => (n.id === pid ? { ...n, children: [...n.children, { id: tmpId, parentId: pid, content, ...base }] } : n))
        : [...ns, { id: tmpId, parentId: "", content, children: [], ...base }],
    ));
    setNewTask("");
    inputRef.current?.focus();
    try {
      const r = await createTaskAction({ userId: sel, content, parentId: pid || undefined, date });
      if (r.ok && r.data) {
        const realId = r.data;
        setByUser((prev) => withUser(prev, sel, (ns) => ns.map((n) =>
          n.id === tmpId ? { ...n, id: realId }
            : { ...n, children: n.children.map((c) => (c.id === tmpId ? { ...c, id: realId } : c)) },
        )));
      } else {
        setByUser((prev) => withUser(prev, sel, (ns) => ns.filter((n) => n.id !== tmpId).map((n) => ({ ...n, children: n.children.filter((c) => c.id !== tmpId) }))));
        toast(r.error || "Couldn't add task");
      }
    } finally { busyRef.current--; }
  }

  async function del(id: string) {
    const snapshot = byUser;
    setByUser((prev) => withUser(prev, sel, (ns) => ns.filter((n) => n.id !== id).map((n) => ({ ...n, children: n.children.filter((c) => c.id !== id) }))));
    busyRef.current++;
    try {
      const r = await deleteTaskAction({ id });
      if (!r.ok) { setByUser(snapshot); toast(r.error || "Couldn't remove"); }
    } finally { busyRef.current--; }
  }

  async function saveContent(id: string, content: string) {
    setByUser((prev) => withUser(prev, sel, (ns) => ns.map((n) =>
      n.id === id ? { ...n, content } : { ...n, children: n.children.map((c) => (c.id === id ? { ...c, content } : c)) },
    )));
    busyRef.current++;
    try { const r = await setTaskContentAction({ id, content }); if (!r.ok) toast(r.error || "Error"); return r.ok; }
    finally { busyRef.current--; }
  }

  // ---- drag to reorder (within a sibling group) ----
  const dragRef = useRef<{ id: string; parentId: string } | null>(null);
  const [dragId, setDragId] = useState("");
  function onDragStart(e: React.DragEvent, id: string, pid: string) {
    if (isTemp(id)) { e.preventDefault(); return; }
    dragRef.current = { id, parentId: pid };
    draggingRef.current = true;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch { /* some browsers */ }
  }
  function onRowDragEnter(targetId: string, pid: string) {
    const d = dragRef.current;
    if (!d || d.id === targetId || d.parentId !== pid || isTemp(targetId)) return;
    setByUser((prev) => pid
      ? withUser(prev, sel, (ns) => ns.map((n) => (n.id === pid ? { ...n, children: moveBefore(n.children, d.id, targetId) } : n)))
      : withUser(prev, sel, (ns) => moveBefore(ns, d.id, targetId)));
  }
  function onDragEnd() {
    const d = dragRef.current;
    dragRef.current = null;
    setDragId("");
    if (!d) { draggingRef.current = false; return; }
    const ids = groupIds(byUser[sel] || [], d.parentId);
    busyRef.current++;
    reorderTasksAction({ ids })
      .then((r) => { if (!r.ok) toast(r.error || "Couldn't save order"); })
      .finally(() => { busyRef.current--; draggingRef.current = false; });
  }

  function startSub(pid: string) { setParentId(pid); inputRef.current?.focus(); }

  async function resetDay() {
    if (!window.confirm("Clear ALL of today's tasks so you can start a fresh day plan? This can't be undone.")) return;
    setBusyReset(true);
    const r = await resetDayAction({ date });
    if (r.ok) { toast(r.message || "Cleared"); lastSig.current = ""; router.refresh(); } else toast(r.error || "Error");
    setBusyReset(false);
  }
  async function saveWt() {
    const r = await setWeekTargetAction({ userId: sel, text: wt });
    if (r.ok) toast(r.message || "Saved"); else toast(r.error || "Error");
  }
  async function saveFooter() {
    const r = await setFooterAction({ text: ft });
    if (r.ok) toast(r.message || "Saved"); else toast(r.error || "Error");
  }
  async function copyPrev() {
    const hasTasks = Object.values(byUser).some((arr) => arr.length > 0);
    if (hasTasks && !window.confirm("This day already has tasks. Copy the previous day's plan on top anyway?")) return;
    setBusyCopy(true);
    const r = await copyPreviousDayPlanAction({ date });
    if (r.ok) { toast(r.message || "Copied"); lastSig.current = ""; router.refresh(); } else toast(r.error || "Error");
    setBusyCopy(false);
  }

  const rowDragProps = (id: string, pid: string) => ({
    onDragOver: (e: React.DragEvent) => { if (dragRef.current) e.preventDefault(); },
    onDragEnter: () => onRowDragEnter(id, pid),
  });

  return (
    <div className="grid g-2-1">
      <div className="stack">
        <div className="card pad">
          <div className="between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 className="sec">Day Plan Builder</h3>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={copyPrev} disabled={busyCopy} type="button">
                {busyCopy ? "Copying…" : "↻ Copy previous day"}
              </button>
              <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5, color: "var(--bad)" }} onClick={resetDay} disabled={busyReset} type="button" title="Clear all of today's tasks and start fresh">
                {busyReset ? "Resetting…" : "⟳ Reset today"}
              </button>
            </div>
          </div>

          <div className="grid g-2" style={{ gap: 10, marginBottom: 14 }}>
            <div>
              <label className="lbl">Department</label>
              <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="all">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Teammate</label>
              <select className="inp" value={sel} onChange={(e) => setSel(e.target.value)}>
                {scoped.map((u) => <option key={u.id} value={u.id}>{u.name} (@{u.handle})</option>)}
                {!scoped.length && <option value="">No teammates in {dept}</option>}
              </select>
            </div>
          </div>

          <label className="lbl">Week target</label>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <input className="inp" value={wt} onChange={(e) => setWt(e.target.value)} placeholder="e.g. Phase 4 — Medication module" />
            <button className="btn btn-ghost" onClick={saveWt} style={{ padding: "10px 14px" }}>Save</button>
          </div>

          <div className="between" style={{ marginBottom: 6 }}>
            <label className="lbl" style={{ margin: 0 }}>Tasks for {selName}</label>
            {nodes.length > 1 && <span className="tiny faint">Drag ⠿ to reorder</span>}
          </div>
          <div className="stack" style={{ gap: 2, marginBottom: 12 }}>
            {nodes.length === 0 && <p className="tiny faint" style={{ margin: 0 }}>No tasks yet for {selName}.</p>}
            {nodes.map((n) => (
              <div key={n.id}>
                <div className={`dp-row${dragId === n.id ? " dragging" : ""}`} {...rowDragProps(n.id, "")}>
                  <span className="dp-drag" draggable onDragStart={(e) => onDragStart(e, n.id, "")} onDragEnd={onDragEnd} title="Drag to reorder">⠿</span>
                  <span className="dp-bullet">o</span>
                  <TaskInput id={n.id} content={n.content} onSave={saveContent} />
                  <button className="dp-mini" onClick={() => startSub(n.id)} type="button" title="Add a sub-bullet under this">＋</button>
                  <button className="chip dp-remove" onClick={() => del(n.id)} style={{ padding: "3px 9px", fontSize: 11 }} type="button">Remove</button>
                </div>
                {n.children.map((c) => (
                  <div key={c.id} className={`dp-row${dragId === c.id ? " dragging" : ""}`} style={{ paddingLeft: 22 }} {...rowDragProps(c.id, n.id)}>
                    <span className="dp-drag" draggable onDragStart={(e) => onDragStart(e, c.id, n.id)} onDragEnd={onDragEnd} title="Drag to reorder">⠿</span>
                    <span className="dp-bullet">–</span>
                    <TaskInput id={c.id} content={c.content} child onSave={saveContent} />
                    <button className="chip dp-remove" onClick={() => del(c.id)} style={{ padding: "3px 9px", fontSize: 11 }} type="button">Remove</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <input
              ref={inputRef}
              className="inp"
              placeholder={parentId ? "New sub-bullet…" : "New task…"}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
            />
            <div className="row" style={{ gap: 8 }}>
              <select className="inp" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Top-level bullet (o)</option>
                {parentOptions.map((n) => <option key={n.id} value={n.id}>Sub-bullet of: {n.content.slice(0, 26)}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => addTask()} disabled={!sel} style={{ whiteSpace: "nowrap" }}>＋ Add</button>
            </div>
            {parentId && <span className="tiny faint">Adding under “{nodes.find((n) => n.id === parentId)?.content.slice(0, 40)}” · <button className="linklike" type="button" onClick={() => setParentId("")}>make top-level</button></span>}
          </div>
        </div>

        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 4 }}>Show in day plan</h3>
          <p className="muted tiny" style={{ margin: "0 0 12px" }}>Tick who appears in the {dept === "all" ? "plan" : `${dept} plan`}. Add tasks to anyone above to include them.</p>
          {candidates.length === 0 ? (
            <p className="tiny faint" style={{ margin: 0 }}>No one has tasks in this scope yet.</p>
          ) : (
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {candidates.map((u) => (
                <label key={u.id} className={`chip${hidden.has(u.id) ? "" : " on"}`} style={{ cursor: "pointer", gap: 6, borderColor: hidden.has(u.id) ? undefined : "var(--accent)", background: hidden.has(u.id) ? undefined : "var(--accent-wash)", color: hidden.has(u.id) ? undefined : "var(--accent-ink)" }}>
                  <input type="checkbox" checked={!hidden.has(u.id)} onChange={() => toggleHidden(u.id)} style={{ accentColor: "var(--accent)" }} />
                  {u.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {canEditFooter && (
          <div className="card pad">
            <label className="lbl">Plan footer — testing plan, release points, reminders…</label>
            <textarea className="inp" style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: 12.5 }} value={ft} onChange={(e) => setFt(e.target.value)} placeholder={"*Testing Plan* - @dhruvi @aastha\no ...\n\nRelease points(6th aug):\no ..."} />
            <button className="btn btn-ghost" onClick={saveFooter} style={{ marginTop: 10 }}>Save footer</button>
          </div>
        )}
      </div>

      <div className="copybox" style={{ alignSelf: "start" }}>
        <div className="cbar">
          <span className="cttl">DAY PLAN{dept === "all" ? "" : ` · ${dept}`} — copy &amp; post</span>
          <CopyButton text={planText} />
        </div>
        <pre>{planText}</pre>
      </div>
    </div>
  );
}
