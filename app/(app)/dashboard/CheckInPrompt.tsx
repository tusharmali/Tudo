"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkInAction } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";
import { getCurrentCoords, type Coords } from "@/lib/geo";

export default function CheckInPrompt({ wfhApproved, locationExempt = false }: { wfhApproved: boolean; locationExempt?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  async function checkIn() {
    setBusy(true);
    try {
      let coords: Coords = { lat: 0, lng: 0, accuracy: 0 };
      if (!wfhApproved && !locationExempt) coords = await getCurrentCoords();
      else {
        try {
          coords = await getCurrentCoords();
        } catch {
          /* WFH / GPS-exempt: location optional */
        }
      }
      const res = await checkInAction(coords);
      if (res.ok) {
        toast(res.message || "Checked in ✓");
        router.refresh();
      } else toast(res.error || "Couldn't check in");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check in");
    }
    setBusy(false);
  }

  return (
    <div className="card pad checkin-prompt" style={{ marginBottom: 18 }}>
      <div className="between" style={{ gap: 14, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 14, minWidth: 0 }}>
          <div className="cip-ic">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10Z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 750, fontSize: 15.5 }}>You&apos;re not checked in yet</div>
            <div className="tiny muted">{wfhApproved ? "You're approved for WFH today — check in from anywhere." : "Mark your attendance for today. It only takes a tap."}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flex: "none" }}>
          <button className="btn btn-primary" onClick={checkIn} disabled={busy} style={{ whiteSpace: "nowrap" }}>
            {busy ? "Checking…" : "Check in now"}
          </button>
          <button className="btn btn-ghost" onClick={() => setHidden(true)} disabled={busy} style={{ padding: "10px 12px" }} title="Later">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
