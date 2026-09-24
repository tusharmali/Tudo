import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager, canPlan, manageDeptsOf } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import { listByDate, nowHM } from "@/lib/attendance";
import { listBreaks, breakDiffMin } from "@/lib/breaks";
import { listUpcomingApproved, listPending, leaveLabel } from "@/lib/leave";
import { todayStr } from "@/lib/db";
import Avatar, { avatarSrc } from "@/components/Avatar";
import ExportBreaksButton from "./ExportBreaksButton";

export const dynamic = "force-dynamic";

export default async function TeamLogPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canPlan(user)) redirect("/dashboard");

  const manager = isManager(user.role);
  const myDepts = manageDeptsOf(user); // scoped departments for non-managers
  const date = todayStr();
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  const [users, todayAtt, weekBreaks, approved, pending] = await Promise.all([
    listUsers(),
    listByDate(date),
    listBreaks({ sinceDate: since }),
    listUpcomingApproved(),
    listPending(),
  ]);

  // Who's in scope: managers see everyone; others see their managed departments.
  const inScope = (dept: string) => manager || myDepts.includes(dept);
  const scopeUsers = users.filter((u) => inScope(u.department || ""));
  const umap: Record<string, { name: string; dept: string; avatar: string; color: string }> = {};
  for (const u of users) umap[u.id] = { name: u.name, dept: u.department || "—", avatar: u.avatar, color: u.avatarColor };
  const scopeIds = new Set(scopeUsers.map((u) => u.id));

  // ---- Today: per-person break tally + attendance ----
  const todayBreaks = weekBreaks.filter((b) => b.date === date && scopeIds.has(b.userId));
  const now = nowHM();
  const todayByUser: Record<string, { count: number; min: number; open: string }> = {};
  for (const b of todayBreaks) {
    const t = (todayByUser[b.userId] ||= { count: 0, min: 0, open: "" });
    t.count += 1;
    if (b.end) t.min += Number(b.durationMin || 0);
    else {
      t.open = b.start;
      t.min += breakDiffMin(b.start, now);
    }
  }

  const roster = scopeUsers
    .filter((u) => (u.status || "active") !== "suspended")
    .map((u) => {
      const rec = todayAtt.find((t) => t.userId === u.id);
      const brk = todayByUser[u.id];
      return {
        id: u.id,
        name: u.name,
        dept: u.department || "—",
        avatar: u.avatar,
        color: u.avatarColor,
        checkIn: rec?.checkIn || "",
        checkOut: rec?.checkOut || "",
        count: brk?.count || 0,
        min: brk?.min || 0,
        onBreak: !!brk?.open,
        openSince: brk?.open || "",
      };
    })
    .sort((a, b) => Number(b.onBreak) - Number(a.onBreak) || b.min - a.min || a.name.localeCompare(b.name));

  const onBreakNow = roster.filter((r) => r.onBreak);

  // ---- Break history (last 7 days) ----
  const history = weekBreaks
    .filter((b) => scopeIds.has(b.userId))
    .map((b) => ({
      date: b.date,
      name: umap[b.userId]?.name || "Unknown",
      dept: umap[b.userId]?.dept || "—",
      start: b.start,
      end: b.end,
      durationMin: b.end ? String(b.durationMin || 0) : "",
      note: b.note || "",
    }));

  // ---- Leave (approved upcoming + pending) in scope ----
  const leaveRows = [...pending.map((l) => ({ ...l, _p: true })), ...approved.map((l) => ({ ...l, _p: false }))]
    .filter((l) => scopeIds.has(l.userId))
    .map((l) => ({
      id: l.id,
      name: umap[l.userId]?.name || "Unknown",
      dept: umap[l.userId]?.dept || "—",
      label: leaveLabel(l.type, l.half),
      from: l.fromDate,
      to: l.toDate,
      reason: l.reason,
      pending: l._p,
    }))
    .sort((a, b) => Number(b.pending) - Number(a.pending) || a.from.localeCompare(b.from));

  const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const scopeLabel = manager ? "All departments" : myDepts.join(" · ") || "Your department";

  return (
    <>
      <div className="between" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Team log</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Breaks &amp; leave · {scopeLabel}</p>
        </div>
        <ExportBreaksButton rows={history} filename={`breaks-${date}.csv`} />
      </div>

      {/* On break now */}
      <div className="card pad" style={{ marginBottom: 18 }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>On a break right now</h3>
        {onBreakNow.length === 0 ? (
          <p className="tiny faint" style={{ margin: 0 }}>Nobody&apos;s on a break right now.</p>
        ) : (
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {onBreakNow.map((r) => (
              <div key={r.id} className="brk-chip">
                <Avatar name={r.name} color={r.color} src={avatarSrc({ id: r.id, avatar: r.avatar })} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>{r.name}</div>
                  <div className="tiny faint">since {r.openSince} · {fmtMin(r.min)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="between" style={{ padding: "18px 22px 6px" }}>
          <h3 className="sec">Today · {roster.length} member{roster.length === 1 ? "" : "s"}</h3>
          <span className="pill p-peri">{scopeLabel}</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Department</th>
                <th>Checked in</th>
                <th>Breaks</th>
                <th>Break time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="row">
                      <Avatar name={r.name} color={r.color} src={avatarSrc({ id: r.id, avatar: r.avatar })} size="sm" />
                      {r.name}
                    </div>
                  </td>
                  <td className="tiny muted">{r.dept}</td>
                  <td className="num">{r.checkIn || "—"}{r.checkOut ? ` · out ${r.checkOut}` : ""}</td>
                  <td className="num">{r.count || "—"}</td>
                  <td className="num">{r.min > 0 ? fmtMin(r.min) : "—"}</td>
                  <td>
                    {r.onBreak ? (
                      <span className="pill p-warn"><span className="d" />On break</span>
                    ) : r.checkIn && !r.checkOut ? (
                      <span className="pill p-good"><span className="d" />On shift</span>
                    ) : r.checkOut ? (
                      <span className="pill p-neut">Left</span>
                    ) : (
                      <span className="pill p-neut">Not in</span>
                    )}
                  </td>
                </tr>
              ))}
              {roster.length === 0 && (
                <tr><td colSpan={6} className="tiny faint" style={{ textAlign: "center", padding: 20 }}>No members in scope.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="between" style={{ padding: "18px 22px 6px" }}>
          <h3 className="sec">Leave &amp; time off</h3>
          {manager && <Link href="/attendance" className="pill p-peri">Review requests →</Link>}
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Department</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveRows.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td className="tiny muted">{l.dept}</td>
                  <td><span className="pill p-sky">{l.label}</span></td>
                  <td className="tiny">{l.from === l.to ? l.from : `${l.from} → ${l.to}`}</td>
                  <td className="tiny muted">{l.reason || "—"}</td>
                  <td>{l.pending ? <span className="pill p-warn">Pending</span> : <span className="pill p-good">Approved</span>}</td>
                </tr>
              ))}
              {leaveRows.length === 0 && (
                <tr><td colSpan={6} className="tiny faint" style={{ textAlign: "center", padding: 20 }}>No upcoming leave or pending requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="between" style={{ padding: "18px 22px 6px" }}>
          <h3 className="sec">Break history · last 7 days</h3>
          <span className="tiny faint">{history.length} break{history.length === 1 ? "" : "s"}</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Department</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td className="tiny">{h.date}</td>
                  <td>{h.name}</td>
                  <td className="tiny muted">{h.dept}</td>
                  <td className="num">{h.start}</td>
                  <td className="num">{h.end || <span className="pill p-warn" style={{ fontSize: 10 }}>ongoing</span>}</td>
                  <td className="num">{h.durationMin ? fmtMin(Number(h.durationMin)) : "—"}</td>
                  <td className="tiny muted">{h.note || "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={7} className="tiny faint" style={{ textAlign: "center", padding: 20 }}>No breaks recorded in the last 7 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
