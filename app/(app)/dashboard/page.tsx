import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { todayStr } from "@/lib/db";
import DashboardTeam from "./DashboardTeam";
import CheckInPrompt from "./CheckInPrompt";
import { getToday, listByDate, isGeoExempt } from "@/lib/attendance";
import { statusForToday, listApprovedForDate, listPending } from "@/lib/leave";
import { listForUser as listTasksForUser, toTree } from "@/lib/tasks";
import { listForUser as listNotifsForUser } from "@/lib/notifications";
import { listReleases } from "@/lib/releases";
import { listPolls, allVotes, pollIsOpen, canSeePoll } from "@/lib/polls";
import { listBreaks } from "@/lib/breaks";
import { getSettings } from "@/lib/settings";
import { listUsers } from "@/lib/users";
import DashboardPolls from "./DashboardPolls";
import BreakControl from "@/components/BreakControl";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = isManager(user.role);
  const date = todayStr();

  const [settings, myAtt, myLeave, myTasks, notifs, releases, myExempt, polls, votes, myBreaks] = await Promise.all([
    getSettings(),
    getToday(user.sub),
    statusForToday(user.sub),
    listTasksForUser(user.sub, date),
    listNotifsForUser(user.sub),
    listReleases(),
    isGeoExempt(user.sub),
    listPolls(),
    allVotes(),
    listBreaks({ date, userIds: [user.sub] }),
  ]);

  // Break state for the shift break widget (only while on shift).
  const openBreak = myBreaks.find((b) => !b.end) || null;
  const breaksToday = myBreaks.length;
  const breakMinToday = myBreaks.filter((b) => b.end).reduce((s, b) => s + Number(b.durationMin || 0), 0);
  const onShift = !!myAtt?.checkIn && !myAtt?.checkOut && !myLeave.onLeave;

  // Open polls this person can vote in, with their current choice.
  const myVotes: Record<string, string> = {};
  for (const v of votes) if (v.userId === user.sub) myVotes[v.pollId] = v.option;
  const pollCards = polls
    .filter((p) => pollIsOpen(p) && canSeePoll(p, { dept: user.dept }))
    .map((p) => ({ id: p.id, question: p.question, options: p.options, closesAt: p.closesAt, myVote: myVotes[p.id] || "" }));

  // Releases is a Tech-department surface; other departments get their own module link.
  const canSeeReleases = isAdmin || user.dept === "Tech";
  const deptLink =
    user.dept === "Digi"
      ? { href: "/shoots", label: "Shoots & Clients", sub: "Your team board" }
      : user.dept === "Support"
        ? { href: "/milestones", label: "Milestones", sub: "Your goals" }
        : { href: "/kudos", label: "Kudos", sub: "Appreciate a teammate" };

  const myTree = toTree(myTasks);
  let open = 0;
  let done = 0;
  for (const n of myTree) {
    for (const t of [n, ...n.children]) t.status === "done" ? done++ : open++;
  }

  const weekTarget = settings[`weektarget:${user.sub}`] || "";
  const lastRead = settings[`notifread:${user.sub}`] || "";
  const unread = notifs.filter((n) => (n.createdAt || "") > lastRead).length;
  const latestNotif = notifs[0] || null;
  const nextRelease =
    releases.filter((r) => r.scheduledDate >= date && r.status !== "shipped")[0] ||
    releases.filter((r) => r.status !== "shipped").slice(-1)[0] ||
    null;

  // My attendance card
  let attLabel = "Not in yet";
  let attSub = "Mark your attendance →";
  let attTint = "tint-peach";
  if (myLeave.onLeave) {
    attLabel = "On leave";
    attSub = "Attendance is locked today";
    attTint = "tint-blush";
  } else if (myAtt?.checkIn) {
    attLabel = myAtt.type === "wfh" ? "WFH" : "Checked in";
    attSub = `Since ${myAtt.checkIn}${myAtt.checkOut ? ` · out ${myAtt.checkOut}` : ""}`;
    attTint = "tint-mint";
  }

  // Admin team snapshot
  let present = 0;
  let wfh = 0;
  let leave = 0;
  let totalUsers = 0;
  let pending = 0;
  let roster: { u: User; state: string }[] = [];
  if (isAdmin) {
    const [users, todayAtt, approved, pend] = await Promise.all([
      listUsers(),
      listByDate(date),
      listApprovedForDate(date),
      listPending(),
    ]);
    totalUsers = users.length;
    pending = pend.length;
    roster = users.map((u) => {
      const rec = todayAtt.find((t) => t.userId === u.id);
      const onLeave = approved.some((a) => a.userId === u.id && a.type === "leave");
      const wfhAppr = approved.some((a) => a.userId === u.id && a.type === "wfh");
      let state = "out";
      if (rec?.checkIn) state = rec.type === "wfh" ? "wfh" : "in";
      else if (onLeave) state = "leave";
      else if (wfhAppr) state = "wfh";
      return { u, state };
    });
    present = roster.filter((r) => r.state === "in").length;
    wfh = roster.filter((r) => r.state === "wfh").length;
    leave = roster.filter((r) => r.state === "leave").length;
  }

  // Quick-access tiles — everything this person can reach, in one place.
  const tiles: { href: string; label: string; emoji: string }[] = [
    { href: "/my", label: "My Space", emoji: "📔" },
    { href: "/updates", label: "Updates & Plan", emoji: "📝" },
    { href: "/attendance", label: "Attendance", emoji: "📍" },
    { href: "/calendar", label: "Calendar", emoji: "📅" },
    { href: "/chat", label: "Chat", emoji: "💬" },
    { href: "/concerns", label: "Concerns", emoji: "🎫" },
    { href: "/kudos", label: "Kudos", emoji: "🏆" },
    ...(canSeeReleases ? [{ href: "/releases", label: "Releases", emoji: "🚀" }] : []),
    ...(isAdmin || user.dept === "Digi" ? [{ href: "/shoots", label: "Shoots", emoji: "📸" }] : []),
    ...(isAdmin || user.dept === "Support" ? [{ href: "/milestones", label: "Milestones", emoji: "🎯" }] : []),
    { href: "/fun", label: "Fun Zone", emoji: "✨" },
    ...(isAdmin
      ? [
          { href: "/people", label: "People", emoji: "👥" },
          { href: "/expenses", label: "Expenses", emoji: "💸" },
          { href: "/assets", label: "Assets", emoji: "💻" },
          { href: "/reports", label: "Reports", emoji: "📊" },
          { href: "/broadcast", label: "Broadcast", emoji: "📣" },
        ]
      : []),
  ];

  return (
    <>
      {!myAtt?.checkIn && !myLeave.onLeave && <CheckInPrompt wfhApproved={myLeave.wfhApproved} locationExempt={myExempt} />}

      {onShift && (
        <div style={{ marginBottom: 18 }}>
          <BreakControl
            checkedIn
            open={openBreak ? { start: openBreak.start, since: openBreak.createdAt } : null}
            count={breaksToday}
            earlierMin={breakMinToday}
          />
        </div>
      )}

      {pollCards.length > 0 && <DashboardPolls polls={pollCards} />}

      <div className="grid g-4 stagger" style={{ marginBottom: 18 }}>
        <Link href="/attendance" className={`stat ${attTint}`}>
          <div className="ic">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10Z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
          </div>
          <div className="k">My attendance</div>
          <div className="v" style={{ fontSize: 22 }}>{attLabel}</div>
          <div className="d muted">{attSub}</div>
        </Link>

        <Link href="/updates" className="stat tint-peri">
          <div className="ic">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 14 2 2 4-4M7 5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
            </svg>
          </div>
          <div className="k">My tasks today</div>
          <div className="v num">{open} open</div>
          <div className="d muted">{done} done{weekTarget ? ` · ${weekTarget.slice(0, 22)}` : ""}</div>
        </Link>

        {isAdmin ? (
          <Link href="/attendance" className="stat tint-sky">
            <div className="ic">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 20v-2a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8" />
              </svg>
            </div>
            <div className="k">Team present</div>
            <div className="v num">{present}<span className="faint" style={{ fontSize: 16 }}>/{totalUsers}</span></div>
            <div className="d muted">{wfh} WFH · {leave} on leave</div>
          </Link>
        ) : canSeeReleases ? (
          <Link href="/releases" className="stat tint-peach">
            <div className="ic">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5s5 1 5 6-6 8-6 8l-3-3s2-9 4-11ZM4.5 16.5 3 21l4.5-1.5" />
              </svg>
            </div>
            <div className="k">Next release</div>
            <div className="v" style={{ fontSize: 20 }}>{nextRelease ? nextRelease.scheduledDate.slice(5).replace("-", "/") : "None"}</div>
            <div className="d muted">{nextRelease ? nextRelease.title.slice(0, 26) : "Nothing scheduled"}</div>
          </Link>
        ) : (
          <Link href={deptLink.href} className="stat tint-peach">
            <div className="ic">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H7l-3 3V5Z" />
              </svg>
            </div>
            <div className="k">{deptLink.label}</div>
            <div className="v" style={{ fontSize: 20 }}>Open</div>
            <div className="d muted">{deptLink.sub}</div>
          </Link>
        )}

        {isAdmin ? (
          <Link href="/attendance" className="stat tint-blush">
            <div className="ic">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
              </svg>
            </div>
            <div className="k">Approvals</div>
            <div className="v num">{pending}</div>
            <div className="d muted">WFH / leave to review</div>
          </Link>
        ) : (
          <Link href="/broadcast" className="stat tint-lilac">
            <div className="ic">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" />
              </svg>
            </div>
            <div className="k">Announcements</div>
            <div className="v num">{unread} new</div>
            <div className="d muted">{latestNotif ? latestNotif.title.slice(0, 26) : "All caught up"}</div>
          </Link>
        )}
      </div>

      <div className="card pad" style={{ marginBottom: 18 }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>Quick access</h3>
        <div className="qa-grid">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="qa-tile">
              <span className="qa-emoji">{t.emoji}</span>
              <span className="qa-label">{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid g-2-1">
        <div className="card pad">
          <div className="between" style={{ marginBottom: 14 }}>
            <h3 className="sec">Your tasks today</h3>
            <Link href="/updates" className="pill p-peri">Open Updates →</Link>
          </div>
          {myTree.length === 0 ? (
            <div className="empty">
              <div className="t">No tasks yet</div>
              <div className="s">Your day plan will appear here once it&apos;s set.</div>
            </div>
          ) : (
            myTree.map((n) => (
              <div className="task" key={n.id} style={{ marginBottom: 8 }}>
                <div className="tbody">
                  <div className="between">
                    <div className="t">{n.content}</div>
                    <span className={`pill ${n.status === "done" ? "p-good" : n.status === "in-progress" ? "p-warn" : "p-neut"}`}>
                      {n.status === "done" ? "Done" : n.status === "in-progress" ? "Doing" : "Pending"}
                    </span>
                  </div>
                  {n.children.length > 0 && (
                    <div className="sub">{n.children.map((c) => c.content).join(" · ")}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="stack">
          {isAdmin ? (
            <DashboardTeam roster={roster.map(({ u, state }) => ({ id: u.id, name: u.name, dept: u.department || "—", state }))} />
          ) : canSeeReleases ? (
            <div className="card pad">
              <div className="lbl">Next release</div>
              {nextRelease ? (
                <>
                  <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16, marginTop: 6 }}>{nextRelease.title}</div>
                  <div className="tiny muted" style={{ marginTop: 3 }}>{nextRelease.scheduledDate}</div>
                </>
              ) : (
                <div className="tiny faint" style={{ marginTop: 6 }}>Nothing scheduled.</div>
              )}
            </div>
          ) : (
            <Link href={deptLink.href} className="card pad" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              <div className="lbl">{deptLink.label}</div>
              <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16, marginTop: 6 }}>{deptLink.sub}</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>Open →</div>
            </Link>
          )}

          <div className="card pad">
            <h3 className="sec" style={{ marginBottom: 10 }}>Latest announcement</h3>
            {latestNotif ? (
              <>
                <div style={{ fontWeight: 650, fontSize: 14 }}>{latestNotif.title}</div>
                {latestNotif.body && <div className="tiny muted" style={{ marginTop: 3 }}>{latestNotif.body}</div>}
              </>
            ) : (
              <div className="tiny faint">No announcements yet.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
