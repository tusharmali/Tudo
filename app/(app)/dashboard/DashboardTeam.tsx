"use client";

import { useMemo, useState } from "react";

type Row = { id: string; name: string; dept: string; state: string };
const META: Record<string, { label: string; pill: string }> = {
  in: { label: "In", pill: "p-good" },
  wfh: { label: "WFH", pill: "p-sky" },
  leave: { label: "Leave", pill: "p-bad" },
  out: { label: "Out", pill: "p-neut" },
};

export default function DashboardTeam({ roster }: { roster: Row[] }) {
  const depts = useMemo(() => [...new Set(roster.map((r) => r.dept))].sort(), [roster]);
  const [dept, setDept] = useState("all");
  const view = dept === "all" ? roster : roster.filter((r) => r.dept === dept);
  const n = (s: string) => view.filter((r) => r.state === s).length;

  return (
    <div className="card pad">
      <div className="between" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <h3 className="sec">Who&apos;s in today</h3>
        <select className="inp" style={{ maxWidth: 160, padding: "6px 10px", fontSize: 12.5 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">All departments</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="row tiny muted" style={{ gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span>{n("in")} in office</span>
        <span>{n("wfh")} WFH</span>
        <span>{n("leave")} leave</span>
        <span>{n("out")} not in</span>
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {view.map((r) => (
          <span className={`pill ${(META[r.state] || META.out).pill}`} key={r.id}>
            <span className="d" />
            {r.name.split(" ")[0]}
            {r.state !== "in" ? ` · ${(META[r.state] || META.out).label}` : ""}
          </span>
        ))}
        {!view.length && <span className="tiny faint">No members in this department.</span>}
      </div>
    </div>
  );
}
