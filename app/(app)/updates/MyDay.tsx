"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setTaskStatusAction, saveTaskUpdateAction } from "@/app/actions/updates";
import { toast } from "@/components/Toaster";
import type { Task, TaskNode } from "@/lib/tasks";

const STEPS: { value: string; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "var(--ink-soft)" },
  { value: "in-progress", label: "Doing", color: "var(--warn)" },
  { value: "done", label: "Done", color: "var(--good)" },
];

function TaskLine({ task, child }: { task: Task; child?: boolean }) {
  const router = useRouter();
  const [upd, setUpd] = useState(task.updateText || "");
  const [localStatus, setLocalStatus] = useState(task.status || "pending");

  // Re-sync when the server data changes (after a refresh).
  useEffect(() => {
    setLocalStatus(task.status || "pending");
  }, [task.status]);

  const done = localStatus === "done";

  async function setStatus(value: string) {
    if (value === localStatus) return;
    setLocalStatus(value); // optimistic — instant feedback
    const r = await setTaskStatusAction({ id: task.id, status: value });
    if (!r.ok) {
      setLocalStatus(task.status || "pending");
      toast(r.error || "Couldn't update");
    } else {
      router.refresh();
    }
  }

  async function saveUpd() {
    if (upd === (task.updateText || "")) return;
    const r = await saveTaskUpdateAction({ id: task.id, updateText: upd });
    if (r.ok) toast("Update saved");
    else toast(r.error || "Error");
  }

  return (
    <div className={`task${done ? " done" : ""}`} style={child ? { marginLeft: 28 } : undefined}>
      <div className="tbody">
        <div className="between" style={{ gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="t" style={{ paddingTop: 3 }}>
            {child ? "— " : ""}
            {task.content}
          </div>
          <div className="seg" style={{ flex: "none" }}>
            {STEPS.map((s) => {
              const on = localStatus === s.value;
              return (
                <button
                  key={s.value}
                  className={on ? "on" : ""}
                  style={on ? { color: s.color } : undefined}
                  onClick={() => setStatus(s.value)}
                  type="button"
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <input
          className="upd"
          placeholder="Add your update / note…"
          value={upd}
          onChange={(e) => setUpd(e.target.value)}
          onBlur={saveUpd}
        />
      </div>
    </div>
  );
}

export default function MyDay({ tree, weekTarget }: { tree: TaskNode[]; weekTarget: string }) {
  let total = 0;
  let done = 0;
  for (const n of tree) {
    total += 1 + n.children.length;
    if (n.status === "done") done += 1;
    done += n.children.filter((c) => c.status === "done").length;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 className="sec">My tasks · today</h3>
          <span className="tiny faint num">
            {done}/{total} done
          </span>
        </div>
        <p className="muted tiny" style={{ margin: "0 0 16px" }}>
          Set each task&apos;s status and jot an update. Your WIP fills in from this automatically.
        </p>
        {tree.length === 0 ? (
          <div className="empty">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2m-6 9 2 2 4-4" />
            </svg>
            <div className="t">No tasks assigned yet</div>
            <div className="s">Your day plan will show up here once it&apos;s set.</div>
          </div>
        ) : (
          tree.map((n) => (
            <div key={n.id}>
              <TaskLine task={n} />
              {n.children.map((c) => (
                <TaskLine key={c.id} task={c} child />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="stack">
        <div className="card pad">
          <div className="lbl">This week&apos;s target</div>
          <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16, marginTop: 6 }}>
            {weekTarget || <span className="faint">Not set yet</span>}
          </div>
          {total > 0 && (
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="tiny faint num">{pct}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
