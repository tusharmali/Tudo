"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideLeaveAction } from "@/app/actions/attendance";
import { setUserShiftAction, setDepartmentShiftAction } from "@/app/actions/team";
import { toast } from "@/components/Toaster";

/** Approve / decline a pending leave request (managers: any; dept admins: their team). */
export function LeaveDecide({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function go(decision: "approved" | "rejected") {
    setBusy(decision);
    const r = await decideLeaveAction({ id, decision });
    if (r.ok) { toast(r.message || "Done"); router.refresh(); } else toast(r.error || "Error");
    setBusy("");
  }
  return (
    <span className="row" style={{ gap: 6 }}>
      <button className="chip" type="button" disabled={!!busy} onClick={() => go("approved")}>Approve</button>
      <button className="chip" type="button" disabled={!!busy} onClick={() => go("rejected")} style={{ color: "var(--bad)" }}>Decline</button>
    </span>
  );
}

type Member = { id: string; name: string; dept: string; shiftIn: string; shiftOut: string };

/** Per-member sign-in / sign-out times (reminder anchors), plus a per-department
 *  bulk setter. Scoped server-side: a dept admin can only touch their own team. */
export function ShiftPanel({ members, departments }: { members: Member[]; departments: string[] }) {
  const [rows, setRows] = useState<Record<string, { in: string; out: string }>>(
    () => Object.fromEntries(members.map((m) => [m.id, { in: m.shiftIn, out: m.shiftOut }])),
  );
  const [busy, setBusy] = useState("");
  const [bDept, setBDept] = useState(departments[0] || "");
  const [bIn, setBIn] = useState("");
  const [bOut, setBOut] = useState("");

  function set(id: string, k: "in" | "out", v: string) {
    setRows((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));
  }
  async function save(m: Member) {
    const cur = rows[m.id] || { in: "", out: "" };
    setBusy(m.id);
    const r = await setUserShiftAction({ userId: m.id, shiftIn: cur.in, shiftOut: cur.out });
    toast(r.ok ? r.message || "Saved" : r.error || "Error");
    setBusy("");
  }
  async function applyBulk() {
    if (!bDept) return toast("Pick a department");
    if (!bIn && !bOut) return toast("Set a sign-in and/or sign-out time");
    if (!window.confirm(`Set these times for everyone in ${bDept}?`)) return;
    setBusy("bulk");
    const r = await setDepartmentShiftAction({ department: bDept, shiftIn: bIn, shiftOut: bOut });
    if (r.ok) {
      toast(r.message || "Saved");
      setRows((p) => { const n = { ...p }; for (const m of members) if (m.dept === bDept) n[m.id] = { in: bIn, out: bOut }; return n; });
    } else toast(r.error || "Error");
    setBusy("");
  }

  return (
    <>
      <div className="row" style={{ padding: "0 20px 14px", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="tiny muted" style={{ fontWeight: 600 }}>Set a whole department:</span>
        <select className="inp" style={{ maxWidth: 160, padding: "6px 8px", fontSize: 12.5 }} value={bDept} onChange={(e) => setBDept(e.target.value)}>
          {departments.length === 0 && <option value="">—</option>}
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="tiny faint">in<input className="inp" type="time" value={bIn} onChange={(e) => setBIn(e.target.value)} style={{ marginLeft: 4, padding: "5px 7px", fontSize: 12.5, width: 110 }} /></label>
        <label className="tiny faint">out<input className="inp" type="time" value={bOut} onChange={(e) => setBOut(e.target.value)} style={{ marginLeft: 4, padding: "5px 7px", fontSize: 12.5, width: 110 }} /></label>
        <button className="chip" type="button" disabled={busy === "bulk"} onClick={applyBulk}>Apply to dept</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Member</th><th>Department</th><th>Sign-in</th><th>Sign-out</th><th></th></tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const cur = rows[m.id] || { in: "", out: "" };
              const dirty = cur.in !== m.shiftIn || cur.out !== m.shiftOut;
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="tiny muted">{m.dept}</td>
                  <td><input className="inp" type="time" value={cur.in} onChange={(e) => set(m.id, "in", e.target.value)} style={{ padding: "5px 7px", fontSize: 12.5, width: 120 }} /></td>
                  <td><input className="inp" type="time" value={cur.out} onChange={(e) => set(m.id, "out", e.target.value)} style={{ padding: "5px 7px", fontSize: 12.5, width: 120 }} /></td>
                  <td><button className={`chip${dirty ? " chip-on" : ""}`} type="button" disabled={busy === m.id || !dirty} onClick={() => save(m)}>{busy === m.id ? "…" : "Save"}</button></td>
                </tr>
              );
            })}
            {members.length === 0 && <tr><td colSpan={5} className="tiny faint" style={{ textAlign: "center", padding: 20 }}>No members in scope.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
