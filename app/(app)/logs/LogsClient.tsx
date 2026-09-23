"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setNotifyPrefAction } from "@/app/actions/notify-prefs";
import { toast } from "@/components/Toaster";

type Log = { id: string; actorName: string; category: string; action: string; detail: string; when: string };
type NotifyAction = { key: string; module: string; label: string };

const CAT_PILL: Record<string, string> = {
  People: "p-peri",
  Security: "p-bad",
  Attendance: "p-good",
  Broadcast: "p-sky",
  Kudos: "p-warn",
  Concerns: "p-neut",
  Settings: "p-sky",
  "Day plan": "p-neut",
};

function NotifySettings({ actions, prefs }: { actions: NotifyAction[]; prefs: Record<string, boolean> }) {
  const router = useRouter();
  const [state, setState] = useState(prefs);
  const [busy, setBusy] = useState("");

  const modules = useMemo(() => [...new Set(actions.map((a) => a.module))], [actions]);

  async function toggle(key: string) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    setBusy(key);
    const r = await setNotifyPrefAction({ key, on: next });
    if (!r.ok) {
      setState((s) => ({ ...s, [key]: !next })); // revert
      toast(r.error || "Error");
    } else {
      toast(r.message || "Saved");
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="card pad" style={{ marginBottom: 18 }}>
      <h3 className="sec" style={{ margin: 0 }}>Member notifications</h3>
      <p className="muted tiny" style={{ margin: "3px 0 14px" }}>
        Choose which actions send a bell + push to the affected member. Off means the action still happens (and is logged) — the member just isn’t pinged.
      </p>
      {modules.map((m) => (
        <div key={m} style={{ marginBottom: 12 }}>
          <div className="tiny faint" style={{ textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{m}</div>
          {actions.filter((a) => a.module === m).map((a) => {
            const on = state[a.key];
            return (
              <div key={a.key} className="between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line, #eee)", gap: 12 }}>
                <span className="tiny" style={{ flex: 1 }}>{a.label}</span>
                <button
                  type="button"
                  className={`pill ${on ? "p-good" : "p-neut"}`}
                  onClick={() => toggle(a.key)}
                  disabled={busy === a.key}
                  style={{ cursor: "pointer", border: "none", minWidth: 54, justifyContent: "center" }}
                >
                  {busy === a.key ? "…" : on ? "On" : "Off"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function LogsClient({
  logs,
  notifyActions = [],
  notifyPrefs = {},
}: {
  logs: Log[];
  notifyActions?: NotifyAction[];
  notifyPrefs?: Record<string, boolean>;
}) {
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
      {notifyActions.length > 0 && <NotifySettings actions={notifyActions} prefs={notifyPrefs} />}

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
