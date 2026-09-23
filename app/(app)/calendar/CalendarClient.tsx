"use client";

import { useMemo, useState } from "react";

type Entry = { userId: string; name: string; color: string; dept: string; type: string; from: string; to: string; reason: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function initials(n: string): string {
  return n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function CalendarClient({ entries }: { entries: Entry[] }) {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [sel, setSel] = useState<string | null>(null);
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  // day -> entries active that day
  const byDay = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const first = ymd(y, m, 1);
    const last = ymd(y, m, new Date(y, m + 1, 0).getDate());
    for (const e of entries) {
      if (e.to < first || e.from > last) continue; // not in this month
      for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
        const day = ymd(y, m, d);
        if (e.from <= day && day <= e.to) (map[day] ||= []).push(e);
      }
    }
    return map;
  }, [entries, y, m]);

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDow = new Date(y, m, 1).getDay();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function prev() {
    if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1);
    setSel(null);
  }
  function next() {
    if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1);
    setSel(null);
  }

  const selEntries = sel ? byDay[sel] || [] : [];

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Team calendar</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Who&apos;s on leave or WFH — approved requests across the team.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={prev} title="Previous month" type="button">‹</button>
          <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16, minWidth: 150, textAlign: "center" }}>{MONTHS[m]} {y}</div>
          <button className="icon-btn" onClick={next} title="Next month" type="button">›</button>
        </div>
      </div>

      <div className="row" style={{ gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <span className="tiny"><span className="cal-dot leave" /> On leave</span>
        <span className="tiny"><span className="cal-dot wfh" /> WFH</span>
      </div>

      <div className="card pad">
        <div className="cal-grid cal-head">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} className="cal-cell empty" />;
            const day = ymd(y, m, d);
            const list = byDay[day] || [];
            const isToday = day === todayStr;
            return (
              <button key={day} type="button" className={`cal-cell${isToday ? " today" : ""}${sel === day ? " sel" : ""}`} onClick={() => setSel(sel === day ? null : day)}>
                <div className="cal-num">{d}</div>
                <div className="cal-people">
                  {list.slice(0, 4).map((e, j) => (
                    <span key={j} className={`cal-av ${e.type}`} style={{ background: e.color }} title={`${e.name} · ${e.type === "wfh" ? "WFH" : "Leave"}`}>{initials(e.name)}</span>
                  ))}
                  {list.length > 4 && <span className="cal-more">+{list.length - 4}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <div className="card pad" style={{ marginTop: 14 }}>
          <h3 className="sec" style={{ marginBottom: 10 }}>{new Date(`${sel}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>
          {selEntries.length === 0 ? (
            <p className="tiny faint">Everyone&apos;s in — nobody on leave or WFH.</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {selEntries.map((e, i) => (
                <div key={i} className="row" style={{ gap: 10 }}>
                  <span className="cal-av" style={{ background: e.color }}>{initials(e.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</span>
                  <span className={`pill ${e.type === "wfh" ? "p-sky" : "p-bad"}`}>{e.type === "wfh" ? "WFH" : "Leave"}</span>
                  {e.dept && <span className="tiny faint">{e.dept}</span>}
                  {e.reason && <span className="tiny muted" style={{ marginLeft: "auto" }}>{e.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
