"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkInAction, checkOutAction, type Coords } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";
import type { AttRecord } from "@/lib/attendance";

function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        reject(new Error(err.code === 1 ? "Location permission denied — enable it to check in." : "Couldn't get your location.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

export default function CheckInCard({
  today,
  onLeave,
  wfhApproved,
}: {
  today: AttRecord | null;
  onLeave: boolean;
  wfhApproved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;

  async function doCheckIn() {
    setBusy(true);
    try {
      let coords: Coords = { lat: 0, lng: 0, accuracy: 0 };
      if (!wfhApproved) {
        coords = await getPosition();
      } else {
        try {
          coords = await getPosition();
        } catch {
          /* WFH: location is optional */
        }
      }
      const res = await checkInAction(coords);
      if (res.ok) {
        toast(res.message || "Checked in ✓");
        router.refresh();
      } else {
        toast(res.error || "Couldn't check in");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check in");
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut() {
    setBusy(true);
    const res = await checkOutAction();
    if (res.ok) {
      toast(res.message || "Checked out");
      router.refresh();
    } else {
      toast(res.error || "Couldn't check out");
    }
    setBusy(false);
  }

  const pin = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );

  return (
    <div className="card pad" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div className={`radar${onLeave ? " off" : ""}`}>
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="core">{pin}</div>
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        {onLeave ? (
          <>
            <span className="pill p-bad">
              <span className="d" />
              On leave
            </span>
            <h3 className="sec" style={{ fontSize: 20, margin: "12px 0 4px" }}>
              You&apos;re on approved leave
            </h3>
            <p className="muted tiny" style={{ margin: 0 }}>
              Attendance is locked today, so you can&apos;t be marked absent. Enjoy the day off.
            </p>
          </>
        ) : checkedIn ? (
          <>
            <span className="pill p-good">
              <span className="d" />
              {today?.type === "wfh" ? "Working from home" : "Checked in"}
            </span>
            <h3 className="sec" style={{ fontSize: 20, margin: "12px 0 4px" }}>
              You&apos;re in — since {today?.checkIn}
            </h3>
            <p className="muted tiny" style={{ margin: "0 0 16px" }}>
              {checkedOut ? `Checked out at ${today?.checkOut}. See you tomorrow!` : "Have a great day. Check out when you leave."}
            </p>
            {!checkedOut && (
              <button className="btn btn-ghost" onClick={doCheckOut} disabled={busy}>
                {busy ? "…" : "Check out"}
              </button>
            )}
          </>
        ) : (
          <>
            <span className="pill p-peri">
              <span className="d" />
              {wfhApproved ? "WFH approved" : "Ready"}
            </span>
            <h3 className="sec" style={{ fontSize: 20, margin: "12px 0 4px" }}>
              Mark your attendance
            </h3>
            <p className="muted tiny" style={{ margin: "0 0 16px" }}>
              {wfhApproved
                ? "You're approved to work from home today — check in from anywhere."
                : "We'll verify you're at the office by GPS. Make sure location is on."}
            </p>
            <button className="btn btn-primary" onClick={doCheckIn} disabled={busy}>
              {busy ? "Checking location…" : "Check in"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
