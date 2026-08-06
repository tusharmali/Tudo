"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestLeaveAction } from "@/app/actions/attendance";
import { toast } from "@/components/Toaster";
import type { LeaveReq } from "@/lib/leave";

const STATUS_CLS: Record<string, string> = { approved: "p-good", rejected: "p-bad", pending: "p-warn" };

export default function LeaveForm({ mine }: { mine: LeaveReq[] }) {
  const router = useRouter();
  const [type, setType] = useState<"leave" | "wfh">("wfh");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!from) {
      toast("Pick a start date");
      return;
    }
    setBusy(true);
    const res = await requestLeaveAction({ type, fromDate: from, toDate: to || from, reason });
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
        Request WFH or Leave
      </h3>
      <p className="muted tiny" style={{ margin: "0 0 14px" }}>
        Goes to a super-admin for approval.
      </p>

      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={type === "wfh" ? "on" : ""} onClick={() => setType("wfh")} type="button">
          Work from home
        </button>
        <button className={type === "leave" ? "on" : ""} onClick={() => setType("leave")} type="button">
          Leave
        </button>
      </div>

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
      <textarea
        className="inp"
        placeholder="Reason (optional)"
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
                  <b style={{ textTransform: "capitalize" }}>{r.type}</b> · {r.fromDate}
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
