import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers, usersMap } from "@/lib/users";
import { getAttConfig, officeIsSet, getToday, listByDate, isGeoExempt, type AttRecord } from "@/lib/attendance";
import { statusForToday, listForUser, listPending, listApprovedForDate, listUpcomingApproved } from "@/lib/leave";
import { listBreaks } from "@/lib/breaks";
import type { User } from "@/lib/types";
import { todayStr } from "@/lib/db";
import Avatar, { avatarSrc } from "@/components/Avatar";
import CheckInCard from "./CheckInCard";
import LeaveForm from "./LeaveForm";
import AdminTools from "./AdminTools";
import AttendanceEditCell from "./AttendanceEditCell";

export const dynamic = "force-dynamic";

type RosterRow = { u: User; rec: AttRecord | undefined; label: string; cls: string };

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = isManager(user.role);

  const [cfg, myToday, myStatus, myLeaves, myExempt, myBreaks] = await Promise.all([
    getAttConfig(),
    getToday(user.sub),
    statusForToday(user.sub),
    listForUser(user.sub),
    isGeoExempt(user.sub),
    listBreaks({ date: todayStr(), userIds: [user.sub] }),
  ]);
  const openBreak = myBreaks.find((b) => !b.end) || null;
  const breakMinToday = myBreaks.filter((b) => b.end).reduce((s, b) => s + Number(b.durationMin || 0), 0);

  type ReqRow = { id: string; userName: string; type: string; half: string; fromDate: string; toDate: string; reason: string };
  let roster: RosterRow[] = [];
  let pending: ReqRow[] = [];
  let approvedReqs: ReqRow[] = [];

  if (isAdmin) {
    const [users, today, approved, pend, upcoming, umap] = await Promise.all([
      listUsers(),
      listByDate(),
      listApprovedForDate(),
      listPending(),
      listUpcomingApproved(),
      usersMap(),
    ]);
    roster = users.map((u) => {
      const rec = today.find((t) => t.userId === u.id);
      const onLeave = approved.some((a) => a.userId === u.id && a.type === "leave");
      const wfhAppr = approved.some((a) => a.userId === u.id && a.type === "wfh");
      const halfReq = approved.find((a) => a.userId === u.id && a.type === "half");
      const shortReq = approved.find((a) => a.userId === u.id && a.type === "short");
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
        // A half-day / early-out person still checks in — flag it alongside.
        if (halfReq) label = "In · half day";
        else if (shortReq) label = "In · early out";
      } else if (onLeave) {
        label = "On leave";
        cls = "p-bad";
      } else if (halfReq) {
        label = "Half day";
        cls = "p-peri";
      } else if (shortReq) {
        label = "Early out";
        cls = "p-peri";
      } else if (wfhAppr) {
        label = "WFH (not in)";
        cls = "p-sky";
      }
      return { u, rec, label, cls };
    });
    const mapReq = (p: { id: string; userId: string; type: string; fromDate: string; toDate: string; reason: string; half: string }): ReqRow => ({
      id: p.id,
      userName: umap[p.userId]?.name || "Unknown",
      type: p.type,
      half: p.half,
      fromDate: p.fromDate,
      toDate: p.toDate,
      reason: p.reason,
    });
    pending = pend.map(mapReq);
    approvedReqs = upcoming.map(mapReq);
  }

  return (
    <>
      <div className="grid g-2-1" style={{ marginBottom: 18 }}>
        <CheckInCard
          today={myToday}
          onLeave={myStatus.onLeave}
          wfhApproved={myStatus.wfhApproved}
          locationExempt={myExempt}
          breakOpen={openBreak ? { start: openBreak.start, since: openBreak.createdAt } : null}
          breakCount={myBreaks.length}
          breakMin={breakMinToday}
        />
        <LeaveForm mine={myLeaves} />
      </div>

      {isAdmin && (
        <>
          <AdminTools pending={pending} approved={approvedReqs} radiusM={cfg.radiusM} officeSet={officeIsSet(cfg)} />
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
                    <th style={{ textAlign: "right" }}>Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(({ u, rec, label, cls }) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row">
                          <Avatar name={u.name} color={u.avatarColor} src={avatarSrc(u)} size="sm" />
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
                      <td>
                        <AttendanceEditCell userId={u.id} name={u.name} date={todayStr()} hasCheckIn={!!rec?.checkIn} hasCheckOut={!!rec?.checkOut} />
                      </td>
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
