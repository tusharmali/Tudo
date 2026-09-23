"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMilestoneAction, setMilestoneStatusAction, deleteMilestoneAction } from "@/app/actions/milestones";
import { toast } from "@/components/Toaster";

type Milestone = { id: string; title: string; targetDate: string; status: string; notes: string; ownerName: string; ownerDept: string };
const STATUS: { key: string; label: string; pill: string }[] = [
  { key: "pending", label: "Pending", pill: "p-neut" },
  { key: "in-progress", label: "In progress", pill: "p-warn" },
  { key: "done", label: "Done", pill: "p-good" },
];

export default function MilestonesClient({
  isManagerView,
  canAdd,
  milestones,
}: {
  isManagerView: boolean;
  canAdd: boolean;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", targetDate: "", notes: "" });

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(key);
    const r = await fn();
    if (r.ok) { if (r.message) toast(r.message); router.refresh(); } else toast(r.error || "Error");
    setBusy(null);
  }
  async function add() {
    if (!form.title.trim()) return toast("Add a milestone title");
    await run("add", () => createMilestoneAction(form));
    setForm({ title: "", targetDate: "", notes: "" });
  }

  return (
    <div className="grid g-2-1">
      <div className="stack">
        {canAdd && (
          <div className="card pad">
            <h3 className="sec" style={{ marginBottom: 4 }}>Add a milestone</h3>
            <p className="muted tiny" style={{ margin: "0 0 14px" }}>Track your goals & targets. {isManagerView ? "You can see the whole team's below." : "Only you and managers can see yours."}</p>
            <input className="inp" placeholder="Milestone (e.g. Cut first-response time to 2h)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ marginBottom: 10 }} />
            <label className="lbl">Target date</label>
            <input className="inp" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} style={{ marginBottom: 10 }} />
            <textarea className="inp" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ minHeight: 64 }} />
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={add} disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add milestone"}</button>
          </div>
        )}
      </div>

      <div className="card pad" style={{ alignSelf: "start" }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>{isManagerView ? "All milestones" : "My milestones"}</h3>
        {milestones.length === 0 && <p className="tiny faint">No milestones yet.</p>}
        <div className="stack" style={{ gap: 12 }}>
          {milestones.map((m) => {
            const meta = STATUS.find((x) => x.key === m.status) || STATUS[0];
            return (
              <div key={m.id} style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <div className="between" style={{ gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{m.title}</div>
                    <div className="tiny faint" style={{ marginTop: 2 }}>
                      {isManagerView ? `${m.ownerName}${m.ownerDept ? ` · ${m.ownerDept}` : ""} · ` : ""}{m.targetDate ? `due ${m.targetDate}` : "no date"}
                    </div>
                  </div>
                  <span className={`pill ${meta.pill}`}>{meta.label}</span>
                </div>
                {m.notes && <div className="tiny muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.notes}</div>}
                <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {STATUS.map((st) => (
                    <button key={st.key} className="chip" style={{ padding: "3px 10px", fontSize: 11, ...(m.status === st.key ? { borderColor: "var(--accent)", background: "var(--accent-wash)", color: "var(--accent-ink)" } : {}) }} disabled={busy === `st:${m.id}`} onClick={() => run(`st:${m.id}`, () => setMilestoneStatusAction({ id: m.id, status: st.key }))}>
                      {st.label}
                    </button>
                  ))}
                  <button className="chip" style={{ padding: "3px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => run(`del:${m.id}`, () => deleteMilestoneAction({ id: m.id }))} disabled={busy === `del:${m.id}`}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
