"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/dal";
import { todayStr } from "@/lib/db";
import {
  getAttConfig,
  officeIsSet,
  haversine,
  recordCheckIn,
  recordCheckOut,
  setOffice,
  nowHM,
} from "@/lib/attendance";
import { statusForToday, createLeave, decide, type LeaveType } from "@/lib/leave";
import { actionError, type Res } from "@/lib/action";

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

    if (st.wfhApproved) {
      type = "wfh";
      status = "wfh";
    } else if (officeIsSet(cfg)) {
      if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
        return { ok: false, error: "Couldn't read your location. Allow location access and try again." };
      }
      if (coords.accuracy && coords.accuracy > cfg.minAccuracyM) {
        return {
          ok: false,
          error: `Location signal is too weak (±${Math.round(coords.accuracy)}m). Step into the open and retry.`,
        };
      }
      distanceM = haversine(coords.lat, coords.lng, cfg.officeLat, cfg.officeLng);
      if (distanceM > cfg.radiusM) {
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
    revalidatePath("/attendance");
    return { ok: true, message: `${input.type === "wfh" ? "WFH" : "Leave"} request sent for approval` };
  } catch (e) {
    return actionError(e);
  }
}

export async function decideLeaveAction(input: { id: string; decision: "approved" | "rejected" }): Promise<Res> {
  try {
    const admin = await requireAdmin();
    await decide(input.id, input.decision, admin.sub);
    revalidatePath("/attendance");
    return { ok: true, message: `Request ${input.decision}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function setOfficeAction(input: { lat: number; lng: number; radius: number }): Promise<Res> {
  try {
    await requireAdmin();
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      return { ok: false, error: "Couldn't read the location." };
    }
    await setOffice(input.lat, input.lng, input.radius || 150);
    revalidatePath("/attendance");
    return { ok: true, message: "Office location saved" };
  } catch (e) {
    return actionError(e);
  }
}
