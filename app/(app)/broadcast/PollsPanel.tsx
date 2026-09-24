"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPollAction, closePollAction, deletePollAction } from "@/app/actions/polls";
import { toast } from "@/components/Toaster";

type PollView = {
  id: string;
  question: string;
  options: string[];
  target: string;
  closesAt: string;
  open: boolean;
  counts: Record<string, number>;
  responded: { id: string; name: string; option: string }[];
  notResponded: { id: string; name: string }[];
  total: number;
};

function fmtClose(iso: string): string {
  if (!iso) return "No time limit";
  const d = new Date(iso);
  const closed = Date.now() >= d.getTime();
  return `${closed ? "Closed" : "Closes"} ${d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}
function closeIso(preset: string, custom: string): string {
  const now = new Date();
  if (preset === "2h") return new Date(now.getTime() + 2 * 3600e3).toISOString();
  if (preset === "eod") { const d = new Date(now); d.setHours(18, 0, 0, 0); if (d < now) d.setDate(d.getDate() + 1); return d.toISOString(); }
  if (preset === "tom9") { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); }
  if (preset === "custom") return custom ? new Date(custom).toISOString() : "";
  return "";
}

export default function PollsPanel({ polls, departments }: { polls: PollView[]; departments: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<string[]>(["I'm in", "Can't make it"]);
  const [target, setTarget] = useState("all");
  const [preset, setPreset] = useState("eod");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState("");
  const [expand, setExpand] = useState<string | null>(null);

  async function create() {
    if (!q.trim()) return toast("Ask a question");
    if (opts.filter((o) => o.trim()).length < 2) return toast("Add at least two options");
    setBusy(true);
    const r = await createPollAction({ question: q, options: opts, target, closesAt: closeIso(preset, custom) });
    if (r.ok) {
      toast(r.message || "Poll sent");
      setQ(""); setOpts(["I'm in", "Can't make it"]); setTarget("all"); setOpen(false);
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }
  async function close(id: string) {
    setAct(id);
    const r = await closePollAction({ pollId: id });
    if (r.ok) { toast(r.message || "Closed"); router.refresh(); } else toast(r.error || "Error");
    setAct("");
  }
  async function del(id: string) {
    if (!window.confirm("Delete this poll and its responses?")) return;
    setAct(id);
    const r = await deletePollAction({ pollId: id });
    if (r.ok) { toast(r.message || "Deleted"); router.refresh(); } else toast(r.error || "Error");
    setAct("");
  }

  return (
    <div className="card pad" style={{ marginTop: 18 }}>
      <div className="between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 className="sec" style={{ margin: 0 }}>Polls</h3>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Ask the team (or a department) a quick question — e.g. who&apos;s coming to an event — with a response deadline.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "+ New poll"}</button>
      </div>

      {open && (
        <div className="card pad" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
          <label className="lbl">Question</label>
          <input className="inp" placeholder="Who's coming to the Friday event?" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          <label className="lbl">Options</label>
          <div className="stack" style={{ gap: 6, marginBottom: 8 }}>
            {opts.map((o, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <input className="inp" value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
                {opts.length > 2 && <button className="chip" type="button" onClick={() => setOpts((p) => p.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
          </div>
          {opts.length < 8 && <button className="btn btn-ghost" type="button" onClick={() => setOpts((p) => [...p, ""])} style={{ padding: "6px 11px", fontSize: 12, marginBottom: 12 }}>+ Add option</button>}
          <div className="grid g-3" style={{ gap: 10, marginBottom: 12 }}>
            <div>
              <label className="lbl">Ask</label>
              <select className="inp" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="all">Everyone</option>
                {departments.map((d) => <option key={d} value={d}>{d} department</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Closes</label>
              <select className="inp" value={preset} onChange={(e) => setPreset(e.target.value)}>
                <option value="2h">In 2 hours</option>
                <option value="eod">Today 6pm</option>
                <option value="tom9">Tomorrow 9am</option>
                <option value="none">No limit</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
            {preset === "custom" && (
              <div>
                <label className="lbl">Close time</label>
                <input className="inp" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? "Sending…" : "Send poll"}</button>
        </div>
      )}

      {polls.length === 0 ? (
        <p className="tiny faint">No polls yet.</p>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {polls.map((p) => {
            const totalVotes = p.responded.length;
            return (
              <div key={p.id} className="card pad" style={{ background: "var(--surface-2)" }}>
                <div className="between" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{p.question}</div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`pill ${p.open ? "p-good" : "p-neut"}`}>{p.open ? "Open" : "Closed"}</span>
                    <span className="pill p-peri">{p.target === "all" ? "Everyone" : p.target}</span>
                  </div>
                </div>
                <div className="tiny faint" style={{ marginBottom: 10 }}>{fmtClose(p.closesAt)} · {totalVotes}/{p.total} responded</div>
                <div className="stack" style={{ gap: 7 }}>
                  {p.options.map((o) => {
                    const c = p.counts[o] || 0;
                    const pct = totalVotes ? Math.round((c / totalVotes) * 100) : 0;
                    return (
                      <div key={o}>
                        <div className="between tiny" style={{ marginBottom: 2 }}><span>{o}</span><span className="faint">{c} · {pct}%</span></div>
                        <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="chip" type="button" onClick={() => setExpand(expand === p.id ? null : p.id)}>{expand === p.id ? "Hide details" : "Who responded"}</button>
                  {p.open && <button className="chip" type="button" disabled={act === p.id} onClick={() => close(p.id)}>Close now</button>}
                  <button className="chip" type="button" disabled={act === p.id} onClick={() => del(p.id)} style={{ color: "var(--bad)" }}>Delete</button>
                </div>
                {expand === p.id && (
                  <div className="grid g-2" style={{ gap: 12, marginTop: 12 }}>
                    <div>
                      <div className="tiny faint" style={{ fontWeight: 700, marginBottom: 6 }}>Responded ({p.responded.length})</div>
                      {p.responded.length === 0 ? <div className="tiny faint">—</div> : p.responded.map((r) => (
                        <div key={r.id} className="between tiny" style={{ padding: "3px 0" }}><span>{r.name}</span><span className="pill p-good" style={{ fontSize: 10 }}>{r.option}</span></div>
                      ))}
                    </div>
                    <div>
                      <div className="tiny faint" style={{ fontWeight: 700, marginBottom: 6 }}>No response yet ({p.notResponded.length})</div>
                      {p.notResponded.length === 0 ? <div className="tiny faint">Everyone responded 🎉</div> : p.notResponded.map((r) => (
                        <div key={r.id} className="tiny" style={{ padding: "3px 0", color: "var(--ink-soft)" }}>{r.name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
