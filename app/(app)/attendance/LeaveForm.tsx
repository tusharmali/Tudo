"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestLeaveAction } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";
import { leaveLabel, type LeaveReq, type LeaveType } from "@/lib/leave";

const STATUS_CLS: Record<string, string> = { approved: "p-good", rejected: "p-bad", pending: "p-warn" };
const TYPES: { key: LeaveType; label: string }[] = [
  { key: "wfh", label: "WFH" },
  { key: "leave", label: "Full leave" },
  { key: "half", label: "Half day" },
  { key: "short", label: "Urgent / early out" },
];

export default function LeaveForm({ mine }: { mine: LeaveReq[] }) {
  const router = useRouter();
  const [type, setType] = useState<LeaveType>("wfh");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [half, setHalf] = useState<"first" | "second">("first");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const single = type === "half" || type === "short"; // single-day by nature

  async function submit() {
    if (!from) {
      toast("Pick a date");
      return;
    }
    if (type === "short" && !reason.trim()) {
      toast("Add a quick reason for the early out");
      return;
    }
    setBusy(true);
    const res = await requestLeaveAction({ type, fromDate: from, toDate: single ? from : to || from, reason, half: type === "half" ? half : "" });
    if (res.ok) {
      toast(res.message || "Sent");
      setReason("");
      setFrom("");
      setTo("");
      router.refresh();
    } else {
      toast(res.error || "Couldn't send");
    }
    setBusy(false);
  }

  return (
    <div className="card pad">
      <h3 className="sec" style={{ marginBottom: 4 }}>
        Request time off
      </h3>
      <p className="muted tiny" style={{ margin: "0 0 14px" }}>
        WFH, leave, a half day, or an urgent early-out — goes to a super-admin for approval.
      </p>

      <div className="seg seg-wrap" style={{ marginBottom: 12 }}>
        {TYPES.map((t) => (
          <button key={t.key} className={type === t.key ? "on" : ""} onClick={() => setType(t.key)} type="button">
            {t.label}
          </button>
        ))}
      </div>

      {single ? (
        <div className="grid g-2" style={{ gap: 12, marginBottom: 12 }}>
          <div>
            <label className="lbl">Date</label>
            <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          {type === "half" && (
            <div>
              <label className="lbl">Which half</label>
              <select className="inp" value={half} onChange={(e) => setHalf(e.target.value as "first" | "second")}>
                <option value="first">First half</option>
                <option value="second">Second half</option>
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="grid g-2" style={{ gap: 12, marginBottom: 12 }}>
          <div>
            <label className="lbl">From</label>
            <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="lbl">To</label>
            <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}
      <textarea
        className="inp"
        placeholder={type === "short" ? "What's the urgency? (required)" : "Reason (optional)"}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ minHeight: 64 }}
      />
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={submit} disabled={busy}>
        {busy ? "Sending…" : "Send request"}
      </button>

      {mine.length > 0 && (
        <>
          <hr className="divider" />
          <div className="lbl" style={{ marginBottom: 8 }}>
            Your requests
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {mine.slice(0, 5).map((r) => (
              <div className="between" key={r.id}>
                <div className="tiny">
                  <b>{leaveLabel(r.type, r.half)}</b> · {r.fromDate}
                  {r.toDate && r.toDate !== r.fromDate ? ` → ${r.toDate}` : ""}
                </div>
                <span className={`pill ${STATUS_CLS[r.status] || "p-neut"}`} style={{ textTransform: "capitalize" }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
