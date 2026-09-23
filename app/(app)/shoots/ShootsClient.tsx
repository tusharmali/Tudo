"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShootAction, setShootStatusAction, deleteShootAction } from "@/app/actions/shoots";
import { toast } from "@/components/Toaster";

type Shoot = { id: string; client: string; title: string; date: string; status: string; assigneeId: string; notes: string };
const STATUS: { key: string; label: string; pill: string }[] = [
  { key: "planned", label: "Planned", pill: "p-neut" },
  { key: "in-progress", label: "In progress", pill: "p-warn" },
  { key: "delivered", label: "Delivered", pill: "p-good" },
];

export default function ShootsClient({
  canEdit,
  members,
  nameById,
  shoots,
}: {
  canEdit: boolean;
  members: { id: string; name: string }[];
  nameById: Record<string, string>;
  shoots: Shoot[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ client: "", title: "", date: "", assigneeId: "", notes: "" });

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(key);
    const r = await fn();
    if (r.ok) { if (r.message) toast(r.message); router.refresh(); } else toast(r.error || "Error");
    setBusy(null);
  }
  async function add() {
    if (!form.client.trim() && !form.title.trim()) return toast("Add a client or a title");
    await run("add", () => createShootAction(form));
    setForm({ client: "", title: "", date: "", assigneeId: "", notes: "" });
  }

  return (
    <div className="grid g-2-1">
      <div className="stack">
        {canEdit && (
          <div className="card pad">
            <h3 className="sec" style={{ marginBottom: 4 }}>Plan a shoot / client</h3>
            <p className="muted tiny" style={{ margin: "0 0 14px" }}>The Digi team's shared shoot & client planning board.</p>
            <div className="grid g-2" style={{ gap: 10 }}>
              <input className="inp" placeholder="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
              <input className="inp" placeholder="Shoot / deliverable title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input className="inp" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <select className="inp" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">Assignee (optional)</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <textarea className="inp" placeholder="Notes — location, brief, gear…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ minHeight: 70, marginTop: 10 }} />
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={add} disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add to board"}</button>
          </div>
        )}
      </div>

      <div className="card pad" style={{ alignSelf: "start" }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>Board</h3>
        {shoots.length === 0 && <p className="tiny faint">Nothing planned yet.</p>}
        <div className="stack" style={{ gap: 12 }}>
          {shoots.map((s) => {
            const meta = STATUS.find((x) => x.key === s.status) || STATUS[0];
            return (
              <div key={s.id} style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <div className="between" style={{ gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{s.client || "—"}{s.title ? ` · ${s.title}` : ""}</div>
                    <div className="tiny faint" style={{ marginTop: 2 }}>
                      {s.date || "no date"}{s.assigneeId && nameById[s.assigneeId] ? ` · ${nameById[s.assigneeId]}` : ""}
                    </div>
                  </div>
                  <span className={`pill ${meta.pill}`}>{meta.label}</span>
                </div>
                {s.notes && <div className="tiny muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{s.notes}</div>}
                {canEdit && (
                  <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {STATUS.map((st) => (
                      <button key={st.key} className="chip" style={{ padding: "3px 10px", fontSize: 11, ...(s.status === st.key ? { borderColor: "var(--accent)", background: "var(--accent-wash)", color: "var(--accent-ink)" } : {}) }} disabled={busy === `st:${s.id}`} onClick={() => run(`st:${s.id}`, () => setShootStatusAction({ id: s.id, status: st.key }))}>
                        {st.label}
                      </button>
                    ))}
                    <button className="chip" style={{ padding: "3px 10px", fontSize: 11, marginLeft: "auto" }} onClick={() => run(`del:${s.id}`, () => deleteShootAction({ id: s.id }))} disabled={busy === `del:${s.id}`}>Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
