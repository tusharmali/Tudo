"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setOfficeAction, decideLeaveAction } from "@/app/actions/attendance";
import { addTeammateAction } from "@/app/actions/team";
import { toast } from "@/components/Toaster";

type Pending = { id: string; userName: string; type: string; fromDate: string; toDate: string; reason: string };

function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => reject(new Error("Couldn't read your location.")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

export default function AdminTools({
  pending,
  radiusM,
  officeSet,
}: {
  pending: Pending[];
  radiusM: number;
  officeSet: boolean;
}) {
  const router = useRouter();
  const [radius, setRadius] = useState(radiusM);
  const [busyOffice, setBusyOffice] = useState(false);
  const [nt, setNt] = useState({ name: "", email: "", password: "", role: "employee", department: "" });
  const [busyAdd, setBusyAdd] = useState(false);

  async function saveOffice() {
    setBusyOffice(true);
    try {
      const c = await getPosition();
      const res = await setOfficeAction({ lat: c.lat, lng: c.lng, radius });
      if (res.ok) {
        toast(res.message || "Saved");
        router.refresh();
      } else toast(res.error || "Error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    }
    setBusyOffice(false);
  }

  async function addTeammate() {
    if (!nt.name || !nt.email || !nt.password) {
      toast("Name, email and password are required");
      return;
    }
    setBusyAdd(true);
    const res = await addTeammateAction({
      name: nt.name,
      email: nt.email,
      password: nt.password,
      role: nt.role === "superadmin" ? "superadmin" : "employee",
      department: nt.department,
    });
    if (res.ok) {
      toast(res.message || "Added");
      setNt({ name: "", email: "", password: "", role: "employee", department: "" });
      router.refresh();
    } else toast(res.error || "Error");
    setBusyAdd(false);
  }

  async function decideReq(id: string, decision: "approved" | "rejected") {
    const res = await decideLeaveAction({ id, decision });
    if (res.ok) {
      toast(res.message || "Done");
      router.refresh();
    } else toast(res.error || "Error");
  }

  return (
    <div className="grid g-3" style={{ marginBottom: 18 }}>
      {/* Office location */}
      <div className="card pad">
        <div className="between" style={{ marginBottom: 4 }}>
          <h3 className="sec">Office location</h3>
          <span className={`pill ${officeSet ? "p-good" : "p-warn"}`}>{officeSet ? "Set" : "Not set"}</span>
        </div>
        <p className="muted tiny" style={{ margin: "0 0 12px" }}>
          Stand at the office and save it as the check-in center. Employees must be within the radius.
        </p>
        <label className="lbl">Allowed radius (m)</label>
        <input
          className="inp"
          type="number"
          min={20}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          style={{ marginBottom: 12 }}
        />
        <button className="btn btn-primary btn-block" onClick={saveOffice} disabled={busyOffice}>
          {busyOffice ? "Reading location…" : "Use my location as office"}
        </button>
      </div>

      {/* Add teammate */}
      <div className="card pad">
        <h3 className="sec" style={{ marginBottom: 12 }}>
          Add a teammate
        </h3>
        <input className="inp" placeholder="Full name" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="inp" placeholder="Email" value={nt.email} onChange={(e) => setNt({ ...nt, email: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="inp" placeholder="Temp password" value={nt.password} onChange={(e) => setNt({ ...nt, password: e.target.value })} style={{ marginBottom: 8 }} />
        <div className="grid g-2" style={{ gap: 8, marginBottom: 10 }}>
          <select className="inp" value={nt.role} onChange={(e) => setNt({ ...nt, role: e.target.value })}>
            <option value="employee">Employee</option>
            <option value="superadmin">Super Admin</option>
          </select>
          <input className="inp" placeholder="Department" value={nt.department} onChange={(e) => setNt({ ...nt, department: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-block" onClick={addTeammate} disabled={busyAdd}>
          {busyAdd ? "Adding…" : "Add teammate"}
        </button>
      </div>

      {/* Pending approvals */}
      <div className="card pad">
        <div className="between" style={{ marginBottom: 12 }}>
          <h3 className="sec">Approvals</h3>
          {pending.length > 0 && <span className="pill p-warn">{pending.length}</span>}
        </div>
        {pending.length === 0 ? (
          <p className="muted tiny" style={{ margin: 0 }}>
            No pending WFH or leave requests. 🎉
          </p>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {pending.map((p) => (
              <div key={p.id} style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 10 }}>
                <div className="tiny" style={{ fontWeight: 650 }}>
                  {p.userName} · <span style={{ textTransform: "capitalize" }}>{p.type}</span>
                </div>
                <div className="tiny faint" style={{ margin: "2px 0 8px" }}>
                  {p.fromDate}
                  {p.toDate && p.toDate !== p.fromDate ? ` → ${p.toDate}` : ""}
                  {p.reason ? ` · ${p.reason}` : ""}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => decideReq(p.id, "approved")}>
                    Approve
                  </button>
                  <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => decideReq(p.id, "rejected")}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
