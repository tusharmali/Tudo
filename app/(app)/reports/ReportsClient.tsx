"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberRow, MemberState } from "@/lib/reports";

const STATE_META: Record<MemberState, { label: string; pill: string }> = {
  in: { label: "In office", pill: "p-good" },
  wfh: { label: "WFH", pill: "p-sky" },
  leave: { label: "On leave", pill: "p-bad" },
  absent: { label: "Not in", pill: "p-warn" },
};

export default function ReportsClient({
  date,
  today,
  rows,
  trend,
}: {
  date: string;
  today: string;
  rows: MemberRow[];
  trend: { date: string; present: number }[];
}) {
  const router = useRouter();
  const [dept, setDept] = useState("all");

  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const view = dept === "all" ? rows : rows.filter((r) => r.department === dept);

  const tally = (list: MemberRow[]) => ({
    in: list.filter((r) => r.state === "in").length,
    wfh: list.filter((r) => r.state === "wfh").length,
    leave: list.filter((r) => r.state === "leave").length,
    absent: list.filter((r) => r.state === "absent").length,
  });
  const t = tally(view);
  const total = view.length || 1;
  const presentPct = Math.round(((t.in + t.wfh) / total) * 100);
  const maxTrend = Math.max(1, ...trend.map((d) => d.present));

  // Per-department breakdown (only when viewing "all").
  const byDept = departments.map((d) => ({ d, ...tally(rows.filter((r) => r.department === d)), size: rows.filter((r) => r.department === d).length }));

  function setDate(d: string) {
    router.push(`/reports?date=${d}`);
  }

  return (
    <>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input className="inp" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 170 }} />
            {date !== today && <button className="btn btn-ghost" onClick={() => setDate(today)} style={{ padding: "8px 12px" }}>Today</button>}
          </div>
          <select className="inp" value={dept} onChange={(e) => setDept(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="all">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid g-4 stagger" style={{ marginBottom: 18 }}>
        <div className="stat tint-mint"><div className="k">In office</div><div className="v num">{t.in}</div><div className="d muted">of {view.length}</div></div>
        <div className="stat tint-sky"><div className="k">WFH</div><div className="v num">{t.wfh}</div><div className="d muted">working remotely</div></div>
        <div className="stat tint-blush"><div className="k">On leave</div><div className="v num">{t.leave}</div><div className="d muted">approved</div></div>
        <div className="stat tint-peach"><div className="k">Attendance</div><div className="v num">{presentPct}%</div><div className="d muted">{t.absent} not in</div></div>
      </div>

      <div className="grid g-2-1">
        <div className="card pad">
          <h3 className="sec" style={{ marginBottom: 12 }}>{dept === "all" ? "Everyone" : dept} · {date === today ? "today" : date}</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Member</th><th>Department</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="tiny muted">{r.department}</td>
                    <td><span className={`pill ${STATE_META[r.state].pill}`}><span className="d" />{STATE_META[r.state].label}</span></td>
                    <td className="num">{r.checkIn || "—"}</td>
                    <td className="num">{r.checkOut || "—"}</td>
                  </tr>
                ))}
                {!view.length && <tr><td colSpan={5} className="tiny faint" style={{ textAlign: "center", padding: 20 }}>No members in this view.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          {dept === "all" && (
            <div className="card pad">
              <h3 className="sec" style={{ marginBottom: 12 }}>By department</h3>
              <div className="stack" style={{ gap: 10 }}>
                {byDept.map((b) => (
                  <div key={b.d}>
                    <div className="between tiny" style={{ marginBottom: 4 }}><b>{b.d}</b><span className="faint">{b.in + b.wfh}/{b.size} in</span></div>
                    <div style={{ height: 8, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(((b.in + b.wfh) / (b.size || 1)) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card pad">
            <h3 className="sec" style={{ marginBottom: 12 }}>Last 7 days present</h3>
            <div className="row" style={{ alignItems: "flex-end", gap: 8, height: 90 }}>
              {trend.map((d) => (
                <div key={d.date} style={{ flex: 1, textAlign: "center" }} title={`${d.date}: ${d.present}`}>
                  <div style={{ height: `${Math.round((d.present / maxTrend) * 70)}px`, minHeight: 3, background: "var(--accent)", borderRadius: 5, marginBottom: 4 }} />
                  <div className="tiny faint">{d.date.slice(8)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
