/**
 * Shift reminders — triggered by a scheduler (Vercel Cron) every few minutes.
 *   • 30 min before a member's sign-in time: "remember to check in"
 *   • at a member's sign-out time (only if still on shift): checkout buzzer
 * Times are each member's shiftIn / shiftOut (set on /team), matched against the
 * current IST wall-clock. One send per member per reminder per day (deduped).
 * Secured by CRON_SECRET: callers must send `Authorization: Bearer <secret>`.
 */
import { listUsers } from "@/lib/users";
import { listActiveForToday } from "@/lib/attendance";
import { notifyUser } from "@/lib/notifications";
import { isNotifyEnabled } from "@/lib/notify-prefs";
import { getSetting, setSetting } from "@/lib/settings";
import { todayStr } from "@/lib/db";

export const dynamic = "force-dynamic";

const WINDOW = 6; // minutes — must be >= the cron interval so no target is missed

function toMin(hm: string): number {
  const m = (hm || "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}
function nowISTMin(): number {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return toMin(hm);
}
/** Is `nowMin` within the window starting at `targetMin` (wrapping midnight)? */
function due(nowMin: number, targetMin: number): boolean {
  if (targetMin < 0) return false;
  const diff = (((nowMin - targetMin) % 1440) + 1440) % 1440;
  return diff < WINDOW;
}
/** First call for this key today wins (marks it sent); later calls return false. */
async function claim(key: string): Promise<boolean> {
  if ((await getSetting(key, "")) === "sent") return false;
  await setSetting(key, "sent");
  return true;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!(await isNotifyEnabled("attendance.reminder"))) {
    return Response.json({ ok: true, skipped: "reminders turned off" });
  }

  const nowMin = nowISTMin();
  const date = todayStr();
  const [users, active] = await Promise.all([listUsers(), listActiveForToday()]);
  const onShift = new Set(active.filter((r) => r.checkIn && !r.checkOut).map((r) => r.userId));

  const sent: string[] = [];
  for (const u of users) {
    if ((u.status || "active") === "suspended") continue;
    const inMin = toMin(u.shiftIn || "");
    const outMin = toMin(u.shiftOut || "");

    // 30 min before sign-in → nudge to check in
    if (inMin >= 0) {
      const target = (inMin - 30 + 1440) % 1440;
      if (due(nowMin, target) && (await claim(`remind:in:${u.id}:${date}`))) {
        await notifyUser(u.id, "⏰ Shift starting soon", `Your shift starts at ${u.shiftIn} — remember to check in.`, "system", "/attendance");
        sent.push(`in:${u.handle}`);
      }
    }
    // at sign-out → checkout buzzer, but only for someone still on shift
    if (outMin >= 0 && onShift.has(u.id) && due(nowMin, outMin)) {
      if (await claim(`remind:out:${u.id}:${date}`)) {
        await notifyUser(u.id, "🔔 Time to check out", `Your shift ends at ${u.shiftOut}. Don't forget to check out.`, "system", "/attendance");
        sent.push(`out:${u.handle}`);
      }
    }
  }
  return Response.json({ ok: true, nowMin, count: sent.length, sent });
}
