"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireManager } from "@/lib/dal";
import { todayStr } from "@/lib/db";
import {
  getAttConfig,
  officeIsSet,
  haversine,
  recordCheckIn,
  recordCheckOut,
  setOffice,
  nowHM,
  isGeoExempt,
  clearCheckOut,
  removeAttendance,
} from "@/lib/attendance";
import { statusForToday, createLeave, decide, getLeave, type LeaveType } from "@/lib/leave";
import { create as createNotification, notifyIfEnabled } from "@/lib/notifications";
import { isNotifyEnabled } from "@/lib/notify-prefs";
import { getUserById } from "@/lib/users";
import { sendToUsers } from "@/lib/push";
import { actionError, type Res } from "@/lib/action";
import { logAction } from "@/lib/audit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fmtRange = (from: string, to: string) => from + (to && to !== from ? ` → ${to}` : "");

export type Coords = { lat: number; lng: number; accuracy: number };

export async function checkInAction(coords: Coords): Promise<Res> {
  try {
    const u = await requireUser();
    const date = todayStr();
    const st = await statusForToday(u.sub, date);
    if (st.onLeave) {
      return { ok: false, error: "You're on approved leave today — attendance is locked." };
    }

    const cfg = await getAttConfig();
    const time = nowHM();
    let type = "office";
    let status = "present";
    let distanceM = 0;

    const exempt = await isGeoExempt(u.sub);
    if (st.wfhApproved) {
      type = "wfh";
      status = "wfh";
    } else if (officeIsSet(cfg) && !exempt) {
      if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
        return { ok: false, error: "Couldn't read your location. Allow location access and try again." };
      }
      // GPS always has an error margin — tiny on phones, but huge on laptops and
      // desktops that locate via Wi-Fi/IP (often many km). We never block on a
      // weak fix: you're treated as "at the office" whenever your accuracy circle
      // could reach the geofence. Only a device that CAN locate precisely and is
      // clearly outside the radius gets stopped. Distance + accuracy are recorded
      // either way, so admins can still spot an implausible check-in.
      const acc = Number.isFinite(coords.accuracy) ? Math.max(0, coords.accuracy) : 0;
      distanceM = haversine(coords.lat, coords.lng, cfg.officeLat, cfg.officeLng);
      const effectiveDistance = Math.max(0, distanceM - acc);
      if (effectiveDistance > cfg.radiusM) {
        return {
          ok: false,
          error: `You're ~${Math.round(distanceM)}m from the office (limit ${cfg.radiusM}m). Get closer, or request WFH.`,
        };
      }
    }
    // If office isn't configured yet, allow check-in so the app works before setup.

    await recordCheckIn({
      userId: u.sub,
      date,
      time,
      type,
      status,
      lat: coords?.lat ?? 0,
      lng: coords?.lng ?? 0,
      accuracy: coords?.accuracy ?? 0,
      distanceM,
    });
    await logAction(u, "Attendance", "Checked in", `${time}${type === "wfh" ? " · WFH" : distanceM ? ` · ~${Math.round(distanceM)}m` : ""}`);
    revalidatePath("/attendance");
    return { ok: true, message: `Checked in at ${time}${type === "wfh" ? " (WFH)" : ""}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function checkOutAction(): Promise<Res> {
  try {
    const u = await requireUser();
    const time = nowHM();
    await recordCheckOut(u.sub, todayStr(), time);
    await logAction(u, "Attendance", "Checked out", time);
    revalidatePath("/attendance");
    return { ok: true, message: `Checked out at ${time}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function requestLeaveAction(input: {
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
}): Promise<Res> {
  try {
    const u = await requireUser();
    if (!input.fromDate) return { ok: false, error: "Pick a start date." };
    if (input.type !== "leave" && input.type !== "wfh") return { ok: false, error: "Choose leave or WFH." };
    await createLeave(u.sub, input.type, input.fromDate, input.toDate || input.fromDate, input.reason);
    await logAction(u, "Attendance", `Requested ${input.type === "wfh" ? "WFH" : "leave"}`, fmtRange(input.fromDate, input.toDate || input.fromDate));
    revalidatePath("/attendance");
    return { ok: true, message: `${input.type === "wfh" ? "WFH" : "Leave"} request sent for approval` };
  } catch (e) {
    return actionError(e);
  }
}

export async function decideLeaveAction(input: { id: string; decision: "approved" | "rejected" }): Promise<Res> {
  try {
    const admin = await requireManager();
    const req = await getLeave(input.id);
    if (!req) return { ok: false, error: "Request not found." };
    const wasApproved = req.status === "approved";
    await decide(input.id, input.decision, admin.sub);

    // Notify the member (bell + push).
    const label = req.type === "wfh" ? "WFH" : "Leave";
    const range = fmtRange(req.fromDate, req.toDate);
    const revoked = wasApproved && input.decision === "rejected";
    const title = input.decision === "approved" ? `${label} approved ✅` : revoked ? `${label} revoked ⚠️` : `${label} not approved`;
    const body = input.decision === "approved"
      ? `Your ${label} for ${range} was approved by ${admin.name}.`
      : revoked
        ? `Your approved ${label} for ${range} was revoked by ${admin.name} — please check in as usual or contact them.`
        : `Your ${label} request for ${range} was declined by ${admin.name}.`;
    if (await isNotifyEnabled("attendance.leave")) {
      await createNotification(title, body, req.userId, admin.sub, "/attendance");
      await sendToUsers([req.userId], { title, body, url: "/attendance" }).catch(() => {});
    }
    await logAction(admin, "Attendance", revoked ? `Revoked ${label}` : input.decision === "approved" ? `Approved ${label}` : `Rejected ${label}`, `${range}`);

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return { ok: true, message: revoked ? `${label} revoked — member notified` : `Request ${input.decision} — member notified` };
  } catch (e) {
    return actionError(e);
  }
}

export async function clearCheckOutAction(input: { userId: string; date: string }): Promise<Res> {
  try {
    const admin = await requireManager();
    const date = DATE.test(input.date) ? input.date : todayStr();
    const n = await clearCheckOut(input.userId, date);
    if (!n) return { ok: false, error: "No check-out to remove for that day." };
    const target = await getUserById(input.userId);
    await logAction(admin, "Attendance", "Removed a check-out", `${target?.name || input.userId} · ${date}`);
    await notifyIfEnabled("attendance.fix", input.userId, "Check-out removed", `${admin.name} removed your check-out for ${date} — you're marked as still in.`, admin.sub, "/attendance");
    revalidatePath("/attendance");
    return { ok: true, message: "Check-out removed" };
  } catch (e) {
    return actionError(e);
  }
}

export async function removeAttendanceAction(input: { userId: string; date: string }): Promise<Res> {
  try {
    const admin = await requireManager();
    const date = DATE.test(input.date) ? input.date : todayStr();
    const n = await removeAttendance(input.userId, date);
    if (!n) return { ok: false, error: "No attendance record for that day." };
    const target = await getUserById(input.userId);
    await logAction(admin, "Attendance", "Cleared attendance record", `${target?.name || input.userId} · ${date}`);
    await notifyIfEnabled("attendance.fix", input.userId, "Attendance cleared", `${admin.name} cleared your attendance for ${date}. Please check in again if you're working.`, admin.sub, "/attendance");
    revalidatePath("/attendance");
    return { ok: true, message: "Attendance cleared" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setOfficeAction(input: { lat: number; lng: number; radius: number }): Promise<Res> {
  try {
    const me = await requireManager();
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      return { ok: false, error: "Couldn't read the location." };
    }
    await setOffice(input.lat, input.lng, input.radius || 150);
    await logAction(me, "Attendance", "Set office location", `${input.lat.toFixed(4)}, ${input.lng.toFixed(4)} · ${input.radius || 150}m`);
    revalidatePath("/attendance");
    return { ok: true, message: "Office location saved" };
  } catch (e) {
    return actionError(e);
  }
}
