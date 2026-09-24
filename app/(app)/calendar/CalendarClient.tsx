"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setWorkDayAction } from "@/app/actions/workcal";
import { decideLeaveAction } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";
import { leaveLabel } from "@/lib/leave";

type Entry = { id: string; userId: string; name: string; color: string; dept: string; type: string; half: string; from: string; to: string; reason: string; status: "approved" | "pending" };
const leavePill = (t: string) => (t === "wfh" ? "p-sky" : t === "half" || t === "short" ? "p-peri" : "p-bad");
type Override = { type: string; note: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function initials(n: string): string {
  return n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function CalendarClient({ entries, overrides, isManager }: { entries: Entry[]; overrides: Record<string, Override>; isManager: boolean }) {
  const router = useRouter();
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [decidingId, setDecidingId] = useState("");
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  const byDay = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    if (!isManager) return map;
    const daysN = new Date(y, m + 1, 0).getDate();
    const first = ymd(y, m, 1);
    const last = ymd(y, m, daysN);
    for (const e of entries) {
      if (e.to < first || e.from > last) continue;
      for (let d = 1; d <= daysN; d++) {
        const day = ymd(y, m, d);
        if (e.from <= day && day <= e.to) (map[day] ||= []).push(e);
      }
    }
    return map;
  }, [entries, y, m, isManager]);

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDow = new Date(y, m, 1).getDay();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function dayState(d: number, day: string) {
    const dow = new Date(y, m, d).getDay();
    const weekend = dow === 0 || dow === 6;
    const ov = overrides[day]?.type || "";
    const off = (weekend && ov !== "working") || ov === "holiday";
    return { weekend, ov, off, working: weekend && ov === "working", holiday: ov === "holiday" };
  }

  function prev() { if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); setSel(null); }
  function next() { if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); setSel(null); }

  async function mark(type: string) {
    if (!sel) return;
    setBusy(true);
    const r = await setWorkDayAction({ date: sel, type, note });
    if (r.ok) { toast(r.message || "Saved"); setNote(""); router.refresh(); } else toast(r.error || "Error");
    setBusy(false);
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    setDecidingId(id);
    const r = await decideLeaveAction({ id, decision });
    if (r.ok) { toast(r.message || "Done"); router.refresh(); } else toast(r.error || "Error");
    setDecidingId("");
  }

  // Requests needing a decision come first in the day detail.
  const selEntries = sel ? [...(byDay[sel] || [])].sort((a, b) => Number(a.status === "approved") - Number(b.status === "approved")) : [];
  const selState = sel ? dayState(Number(sel.slice(8)), sel) : null;

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Team calendar</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Working days &amp; weekends{isManager ? " — plus who's on leave or WFH" : " — weekends are off unless marked working"}.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={prev} title="Previous month" type="button">‹</button>
          <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16, minWidth: 150, textAlign: "center" }}>{MONTHS[m]} {y}</div>
          <button className="icon-btn" onClick={next} title="Next month" type="button">›</button>
        </div>
      </div>

      <div className="row" style={{ gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <span className="tiny"><span className="cal-dot off" /> Weekend / holiday (off)</span>
        <span className="tiny"><span className="cal-dot work" /> Working (weekend open)</span>
        {isManager && <><span className="tiny"><span className="cal-dot leave" /> On leave</span><span className="tiny"><span className="cal-dot wfh" /> WFH</span><span className="tiny"><span className="cal-dot req" /> Requested</span></>}
      </div>

      <div className="card pad">
        <div className="cal-grid cal-head">{DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}</div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} className="cal-cell empty" />;
            const day = ymd(y, m, d);
            const st = dayState(d, day);
            const list = byDay[day] || [];
            const isToday = day === todayStr;
            return (
              <button key={day} type="button" className={`cal-cell${isToday ? " today" : ""}${sel === day ? " sel" : ""}${st.off ? " off" : ""}${st.working ? " working" : ""}${st.holiday ? " holiday" : ""}`} onClick={() => { setSel(sel === day ? null : day); setNote(overrides[day]?.note || ""); }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div className="cal-num">{d}</div>
                  {st.working && <span className="cal-tag work">Working</span>}
                  {st.holiday && <span className="cal-tag off">Holiday</span>}
                </div>
                {isManager && (
                  <div className="cal-people">
                    {list.slice(0, 4).map((e, j) => (
                      <span key={j} className={`cal-av ${e.type}${e.status === "pending" ? " pending" : ""}`} style={{ background: e.color }} title={`${e.name} · ${leaveLabel(e.type, e.half)}${e.status === "pending" ? " (requested)" : ""}`}>{initials(e.name)}</span>
                    ))}
                    {list.length > 4 && <span className="cal-more">+{list.length - 4}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {sel && selState && (
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="between" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <h3 className="sec" style={{ margin: 0 }}>{new Date(`${sel}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>
            <span className={`pill ${selState.off ? "p-neut" : "p-good"}`}>{selState.holiday ? `Holiday${overrides[sel]?.note ? " · " + overrides[sel].note : ""}` : selState.working ? "Working day" : selState.weekend ? "Weekend · off" : "Working day"}</span>
          </div>

          {isManager && (
            <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input className="inp" style={{ maxWidth: 220 }} placeholder="Note (e.g. Diwali, half-day)" value={note} onChange={(e) => setNote(e.target.value)} />
              {selState.weekend && <button className="chip" disabled={busy} onClick={() => mark("working")}>Mark working</button>}
              {!selState.weekend && <button className="chip" disabled={busy} onClick={() => mark("holiday")}>Mark holiday</button>}
              {selState.ov && <button className="chip" disabled={busy} onClick={() => mark("")}>Clear override</button>}
            </div>
          )}

          {isManager && (
            selEntries.length === 0 ? (
              <p className="tiny faint">Nobody on leave, WFH, or requested off.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {selEntries.map((e, i) => (
                  <div key={i} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className={`cal-av${e.status === "pending" ? " pending" : ""}`} style={{ background: e.color }}>{initials(e.name)}</span>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</span>
                    <span className={`pill ${leavePill(e.type)}`}>{leaveLabel(e.type, e.half)}</span>
                    {e.status === "pending" && <span className="pill p-warn">Requested</span>}
                    {e.dept && <span className="tiny faint">{e.dept}</span>}
                    {e.reason && <span className="tiny muted">{e.reason}</span>}
                    {e.status === "pending" && (
                      <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
                        <button className="chip" type="button" disabled={decidingId === e.id} onClick={() => decide(e.id, "approved")}>Approve</button>
                        <button className="chip" type="button" disabled={decidingId === e.id} onClick={() => decide(e.id, "rejected")} style={{ color: "var(--bad)" }}>Decline</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
