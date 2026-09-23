"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearCheckOutAction, removeAttendanceAction } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";

export default function AttendanceEditCell({
  userId,
  name,
  date,
  hasCheckIn,
  hasCheckOut,
}: {
  userId: string;
  name: string;
  date: string;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!hasCheckIn && !hasCheckOut) return <span className="tiny faint">—</span>;

  async function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    const r = await fn();
    if (r.ok) {
      toast(r.message || "Done");
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {hasCheckOut && (
        <button
          className="chip"
          style={{ padding: "4px 9px", fontSize: 11 }}
          disabled={busy}
          onClick={() => run(() => clearCheckOutAction({ userId, date }), `Remove ${name}'s check-out? They'll be marked as still in.`)}
        >
          Undo check-out
        </button>
      )}
      {hasCheckIn && (
        <button
          className="chip"
          style={{ padding: "4px 9px", fontSize: 11 }}
          disabled={busy}
          onClick={() => run(() => removeAttendanceAction({ userId, date }), `Remove ${name}'s whole attendance record for this day?`)}
        >
          Remove check-in
        </button>
      )}
    </div>
  );
}
