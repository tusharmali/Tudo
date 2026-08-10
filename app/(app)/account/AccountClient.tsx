"use client";

import { useState } from "react";
import { changeMyPasswordAction, resetPasswordAction } from "@/app/actions/account";
import { toast } from "@/components/Toaster";

type Lite = { id: string; name: string; email: string };

export default function AccountClient({ name, isAdmin, users }: { name: string; isAdmin: boolean; users: Lite[] }) {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [busy, setBusy] = useState(false);

  const [uid, setUid] = useState(users[0]?.id || "");
  const [rpw, setRpw] = useState("");
  const [busyR, setBusyR] = useState(false);

  async function change() {
    if (nw.length < 6) {
      toast("New password must be at least 6 characters");
      return;
    }
    if (nw !== cf) {
      toast("New passwords don't match");
      return;
    }
    setBusy(true);
    const r = await changeMyPasswordAction({ current: cur, next: nw });
    if (r.ok) {
      toast(r.message || "Updated");
      setCur("");
      setNw("");
      setCf("");
    } else toast(r.error || "Error");
    setBusy(false);
  }

  async function reset() {
    if (rpw.length < 6) {
      toast("Password must be at least 6 characters");
      return;
    }
    setBusyR(true);
    const r = await resetPasswordAction({ userId: uid, next: rpw });
    if (r.ok) {
      toast(r.message || "Reset");
      setRpw("");
    } else toast(r.error || "Error");
    setBusyR(false);
  }

  return (
    <div className="grid g-2" style={{ alignItems: "start" }}>
      <div className="card pad">
        <h3 className="sec" style={{ marginBottom: 4 }}>
          Change your password
        </h3>
        <p className="muted tiny" style={{ margin: "0 0 14px" }}>
          Signed in as {name}.
        </p>
        <label className="lbl">Current password</label>
        <input className="inp" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" style={{ marginBottom: 12 }} />
        <label className="lbl">New password</label>
        <input className="inp" type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" style={{ marginBottom: 12 }} />
        <label className="lbl">Confirm new password</label>
        <input className="inp" type="password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" style={{ marginBottom: 14 }} />
        <button className="btn btn-primary btn-block" onClick={change} disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>

      {isAdmin && (
        <div className="card pad">
          <div className="between" style={{ marginBottom: 4 }}>
            <h3 className="sec">Reset a teammate&apos;s password</h3>
            <span className="pill p-peri">Super Admin</span>
          </div>
          <p className="muted tiny" style={{ margin: "0 0 14px" }}>
            Use this when someone forgets theirs — then share the new password with them directly.
          </p>
          <label className="lbl">Teammate</label>
          <select className="inp" value={uid} onChange={(e) => setUid(e.target.value)} style={{ marginBottom: 12 }}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <label className="lbl">New password</label>
          <input className="inp" type="text" value={rpw} onChange={(e) => setRpw(e.target.value)} placeholder="Set a temporary password" style={{ marginBottom: 14 }} />
          <button className="btn btn-primary btn-block" onClick={reset} disabled={busyR}>
            {busyR ? "Resetting…" : "Reset password"}
          </button>
        </div>
      )}
    </div>
  );
}
