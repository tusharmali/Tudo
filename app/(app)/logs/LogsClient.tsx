"use client";

import { useMemo, useState } from "react";

type Log = { id: string; actorName: string; category: string; action: string; detail: string; when: string };

const CAT_PILL: Record<string, string> = {
  People: "p-peri",
  Security: "p-bad",
  Attendance: "p-good",
  Broadcast: "p-sky",
  Kudos: "p-warn",
  Concerns: "p-neut",
  "Day plan": "p-neut",
};

export default function LogsClient({ logs }: { logs: Log[] }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");

  const categories = useMemo(() => [...new Set(logs.map((l) => l.category))].sort(), [logs]);
  const view = logs.filter((l) => {
    if (cat !== "all" && l.category !== cat) return false;
    const s = q.trim().toLowerCase();
    return !s || l.actorName.toLowerCase().includes(s) || l.action.toLowerCase().includes(s) || l.detail.toLowerCase().includes(s);
  });

  return (
    <>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 className="sec" style={{ margin: 0 }}>Activity log</h3>
            <p className="muted tiny" style={{ margin: "3px 0 0" }}>Who did what across the portal — most recent first ({logs.length} events).</p>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <select className="inp" value={cat} onChange={(e) => setCat(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="inp" placeholder="Search person, action…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>When</th><th>Person</th><th>Category</th><th>Action</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {view.map((l) => (
                <tr key={l.id}>
                  <td className="tiny faint num" style={{ whiteSpace: "nowrap" }}>{l.when}</td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{l.actorName}</td>
                  <td><span className={`pill ${CAT_PILL[l.category] || "p-neut"}`}>{l.category}</span></td>
                  <td className="tiny">{l.action}</td>
                  <td className="tiny muted">{l.detail}</td>
                </tr>
              ))}
              {!view.length && <tr><td colSpan={5} className="tiny faint" style={{ textAlign: "center", padding: 22 }}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
