import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers, usersMap } from "@/lib/users";
import { getAttConfig, officeIsSet, getToday, listByDate, type AttRecord } from "@/lib/attendance";
import { statusForToday, listForUser, listPending, listApprovedForDate } from "@/lib/leave";
import type { User } from "@/lib/types";
import CheckInCard from "./CheckInCard";
import LeaveForm from "./LeaveForm";
import AdminTools from "./AdminTools";

export const dynamic = "force-dynamic";

type RosterRow = { u: User; rec: AttRecord | undefined; label: string; cls: string };

function initials(n: string): string {
  return n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = isManager(user.role);

  const [cfg, myToday, myStatus, myLeaves] = await Promise.all([
    getAttConfig(),
    getToday(user.sub),
    statusForToday(user.sub),
    listForUser(user.sub),
  ]);

  let roster: RosterRow[] = [];
  let pending: { id: string; userName: string; type: string; fromDate: string; toDate: string; reason: string }[] = [];

  if (isAdmin) {
    const [users, today, approved, pend, umap] = await Promise.all([
      listUsers(),
      listByDate(),
      listApprovedForDate(),
      listPending(),
      usersMap(),
    ]);
    roster = users.map((u) => {
      const rec = today.find((t) => t.userId === u.id);
      const onLeave = approved.some((a) => a.userId === u.id && a.type === "leave");
      const wfhAppr = approved.some((a) => a.userId === u.id && a.type === "wfh");
      let label = "Not in";
      let cls = "p-warn";
      if (rec?.checkIn) {
        if (rec.type === "wfh") {
          label = "WFH";
          cls = "p-sky";
        } else {
          label = "In office";
          cls = "p-good";
        }
      } else if (onLeave) {
        label = "On leave";
        cls = "p-bad";
      } else if (wfhAppr) {
        label = "WFH (not in)";
        cls = "p-sky";
      }
      return { u, rec, label, cls };
    });
    pending = pend.map((p) => ({
      id: p.id,
      userName: umap[p.userId]?.name || "Unknown",
      type: p.type,
      fromDate: p.fromDate,
      toDate: p.toDate,
      reason: p.reason,
    }));
  }

  return (
    <>
      <div className="grid g-2-1" style={{ marginBottom: 18 }}>
        <CheckInCard today={myToday} onLeave={myStatus.onLeave} wfhApproved={myStatus.wfhApproved} />
        <LeaveForm mine={myLeaves} />
      </div>

      {isAdmin && (
        <>
          <AdminTools pending={pending} radiusM={cfg.radiusM} officeSet={officeIsSet(cfg)} />
          <div className="card">
            <div className="between" style={{ padding: "18px 22px 6px" }}>
              <h3 className="sec">Team attendance · today</h3>
              <span className="pill p-peri">Super Admin</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(({ u, rec, label, cls }) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row">
                          <div className="avatar sm" style={{ background: u.avatarColor }}>
                            {initials(u.name)}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${cls}`}>
                          <span className="d" />
                          {label}
                        </span>
                      </td>
                      <td className="num">{rec?.checkIn || "—"}</td>
                      <td className="num">{rec?.checkOut || "—"}</td>
                      <td className="tiny muted">{u.department || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
