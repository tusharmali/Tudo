"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction, deleteTaskAction, setWeekTargetAction, setFooterAction, copyPreviousDayPlanAction } from "@/app/actions/updates";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";
import type { TaskNode } from "@/lib/tasks";

export type BuilderUser = { id: string; name: string; handle: string };

export default function DayPlanBuilder({
  users,
  tasksByUser,
  weekTargets,
  footer,
  dayPlanText,
  date,
}: {
  users: BuilderUser[];
  tasksByUser: Record<string, TaskNode[]>;
  weekTargets: Record<string, string>;
  footer: string;
  dayPlanText: string;
  date: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(users[0]?.id || "");
  const [wt, setWt] = useState(weekTargets[sel] || "");
  const [ft, setFt] = useState(footer);
  const [newTask, setNewTask] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);

  useEffect(() => {
    setWt(weekTargets[sel] || "");
    setParentId("");
  }, [sel, weekTargets]);

  const nodes = tasksByUser[sel] || [];
  const selName = users.find((u) => u.id === sel)?.name || "this teammate";

  async function addTask() {
    if (!newTask.trim()) {
      toast("Type the task first");
      return;
    }
    setBusy(true);
    const r = await createTaskAction({ userId: sel, content: newTask, parentId: parentId || undefined, date });
    if (r.ok) {
      toast(r.message || "Added");
      setNewTask("");
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  async function del(id: string) {
    const r = await deleteTaskAction({ id });
    if (r.ok) {
      toast(r.message || "Removed");
      router.refresh();
    } else toast(r.error || "Error");
  }

  async function saveWt() {
    const r = await setWeekTargetAction({ userId: sel, text: wt });
    if (r.ok) {
      toast(r.message || "Saved");
      router.refresh();
    } else toast(r.error || "Error");
  }

  async function saveFooter() {
    const r = await setFooterAction({ text: ft });
    if (r.ok) {
      toast(r.message || "Saved");
      router.refresh();
    } else toast(r.error || "Error");
  }

  async function copyPrev() {
    const hasTasks = Object.values(tasksByUser).some((arr) => arr.length > 0);
    if (hasTasks && !window.confirm("This day already has tasks. Copy the previous day's plan on top anyway?")) return;
    setBusyCopy(true);
    const r = await copyPreviousDayPlanAction({ date });
    if (r.ok) {
      toast(r.message || "Copied");
      router.refresh();
    } else toast(r.error || "Error");
    setBusyCopy(false);
  }

  return (
    <div className="grid g-2-1">
      <div className="stack">
        <div className="card pad">
          <div className="between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 className="sec">Day Plan Builder</h3>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={copyPrev} disabled={busyCopy} type="button">
                {busyCopy ? "Copying…" : "↻ Copy previous day"}
              </button>
              <span className="pill p-peri">Super Admin</span>
            </div>
          </div>

          <label className="lbl">Teammate</label>
          <select className="inp" value={sel} onChange={(e) => setSel(e.target.value)} style={{ marginBottom: 14 }}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} (@{u.handle})
              </option>
            ))}
          </select>

          <label className="lbl">Week target</label>
          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <input className="inp" value={wt} onChange={(e) => setWt(e.target.value)} placeholder="e.g. Phase 4 — Medication module" />
            <button className="btn btn-ghost" onClick={saveWt} style={{ padding: "10px 14px" }}>
              Save
            </button>
          </div>

          <label className="lbl">Tasks</label>
          <div className="stack" style={{ gap: 4, marginBottom: 12 }}>
            {nodes.length === 0 && (
              <p className="tiny faint" style={{ margin: 0 }}>
                No tasks yet for {selName}.
              </p>
            )}
            {nodes.map((n) => (
              <div key={n.id}>
                <div className="between" style={{ padding: "5px 0" }}>
                  <div className="tiny">
                    <b>o</b> {n.content}
                  </div>
                  <button className="chip" onClick={() => del(n.id)} style={{ padding: "3px 9px", fontSize: 11 }} type="button">
                    Remove
                  </button>
                </div>
                {n.children.map((c) => (
                  <div className="between" key={c.id} style={{ padding: "3px 0 3px 22px" }}>
                    <div className="tiny muted">- {c.content}</div>
                    <button className="chip" onClick={() => del(c.id)} style={{ padding: "3px 9px", fontSize: 11 }} type="button">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <input
              className="inp"
              placeholder="New task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <div className="row" style={{ gap: 8 }}>
              <select className="inp" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Top-level bullet (o)</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    Sub-bullet of: {n.content.slice(0, 26)}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={addTask} disabled={busy} style={{ whiteSpace: "nowrap" }}>
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="card pad">
          <label className="lbl">Plan footer — testing plan, release points, reminders…</label>
          <textarea
            className="inp"
            style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: 12.5 }}
            value={ft}
            onChange={(e) => setFt(e.target.value)}
            placeholder={"*Testing Plan* - @dhruvi @aastha\no ...\n\nRelease points(6th aug):\no ..."}
          />
          <button className="btn btn-ghost" onClick={saveFooter} style={{ marginTop: 10 }}>
            Save footer
          </button>
        </div>
      </div>

      <div className="copybox" style={{ alignSelf: "start" }}>
        <div className="cbar">
          <span className="cttl">DAY PLAN — copy &amp; post</span>
          <CopyButton text={dayPlanText} />
        </div>
        <pre>{dayPlanText}</pre>
      </div>
    </div>
  );
}
