"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { draftPlanAction, approvePlanAction, type DraftResult } from "@/app/actions/planner";
import { toast } from "@/components/Toaster";

export default function PlannerPanel({ date }: { date: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function draft() {
    setLoading(true);
    const r = await draftPlanAction({ baseDate: date });
    if (r.ok && r.data) {
      setResult(r.data);
      setEdits(Object.fromEntries(r.data.plans.map((p) => [p.userId, p.targets.join("\n")])));
      if (r.data.plans.length === 0) toast("Nothing open to roll forward — looks clear!");
    } else toast(r.error || "Couldn't draft");
    setLoading(false);
  }

  async function approve() {
    if (!result) return;
    const plans = result.plans.map((p) => ({ userId: p.userId, targets: (edits[p.userId] || "").split("\n").map((s) => s.trim()).filter(Boolean) })).filter((p) => p.targets.length);
    if (!plans.length) return toast("Nothing to set");
    setSaving(true);
    const r = await approvePlanAction({ date: result.date, plans });
    if (r.ok) { toast(r.message || "Plan set"); setResult(null); router.refresh(); } else toast(r.error || "Error");
    setSaving(false);
  }

  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={draft} disabled={loading} style={{ padding: "8px 13px", fontSize: 12.5, whiteSpace: "nowrap" }} title="AI drafts tomorrow's day targets from unfinished work + backlog; you review before it's set">
        {loading ? "Drafting…" : "✨ Draft tomorrow's plan"}
      </button>

      {result && (
        <div className="modal-back" onClick={() => !saving && setResult(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Review next-day plan">
            <div className="between" style={{ marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
              <h3 className="sec" style={{ margin: 0 }}>Plan for {fmtDate(result.date)}</h3>
              <span className="tiny faint">{result.aiUsed ? "✨ AI draft" : "carried forward"} · review &amp; edit, then set</span>
            </div>
            <p className="muted tiny" style={{ margin: "0 0 14px" }}>One target per line. Edit freely — nothing is saved until you approve. This replaces any existing plan for that day.</p>

            {result.plans.length === 0 ? (
              <p className="tiny faint">No unfinished work or backlog to plan from.</p>
            ) : (
              <div className="stack" style={{ gap: 12, maxHeight: "56vh", overflowY: "auto" }}>
                {result.plans.map((p) => (
                  <div key={p.userId} className="card pad" style={{ background: "var(--surface-2)" }}>
                    <div className="between" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontWeight: 650, fontSize: 13.5 }}>{p.name} <span className="tiny faint">{p.dept}</span></span>
                      <span className={`pill ${p.source === "ai" ? "p-peri" : "p-neut"}`} style={{ fontSize: 10 }}>{p.source === "ai" ? "AI" : "carried"}</span>
                    </div>
                    {p.note && <p className="tiny" style={{ margin: "0 0 7px", color: "var(--warn)" }}>⚠ {p.note}</p>}
                    <textarea className="inp" value={edits[p.userId] || ""} onChange={(e) => setEdits((x) => ({ ...x, [p.userId]: e.target.value }))} style={{ minHeight: 84, fontSize: 12.8, lineHeight: 1.5 }} />
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" type="button" onClick={() => setResult(null)} disabled={saving}>Cancel</button>
              {result.plans.length > 0 && <button className="btn btn-primary" type="button" onClick={approve} disabled={saving}>{saving ? "Setting…" : "Approve & set plan"}</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
