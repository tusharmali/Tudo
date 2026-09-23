"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addAssetAction, updateAssetAction, deleteAssetAction } from "@/app/actions/assets";
import { toast } from "@/components/Toaster";
import type { Asset } from "@/lib/assets";

type Person = { id: string; name: string };
const STATUS: Record<string, string> = { "in-use": "p-good", spare: "p-sky", "in-repair": "p-warn", retired: "p-neut" };

export default function AssetsClient({ assets, people, types, statuses }: { assets: Asset[]; people: Person[]; types: string[]; statuses: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", type: types[0], serial: "", provider: "", assignedTo: "", status: "in-use", purchaseDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [ft, setFt] = useState("all");
  const [fs, setFs] = useState("all");

  const view = useMemo(() => assets.filter((a) => (ft === "all" || a.type === ft) && (fs === "all" || a.status === fs)), [assets, ft, fs]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of assets) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [assets]);

  async function add() {
    if (!f.name.trim()) return toast("Name the asset");
    setSaving(true);
    const r = await addAssetAction(f);
    if (r.ok) {
      toast(r.message || "Added");
      setF({ name: "", type: types[0], serial: "", provider: "", assignedTo: "", status: "in-use", purchaseDate: "", notes: "" });
      setOpen(false);
      router.refresh();
    } else toast(r.error || "Error");
    setSaving(false);
  }
  async function patch(id: string, p: Partial<Asset>) {
    setBusy(id);
    const r = await updateAssetAction({ id, patch: p });
    if (r.ok) router.refresh();
    else toast(r.error || "Error");
    setBusy("");
  }
  async function del(id: string) {
    if (!window.confirm("Remove this asset?")) return;
    setBusy(id);
    const r = await deleteAssetAction({ id });
    if (r.ok) { toast(r.message || "Removed"); router.refresh(); } else toast(r.error || "Error");
    setBusy("");
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Asset register</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Company devices — who holds what, the vendor, and repair status. {assets.length} items · {counts["in-repair"] || 0} in repair.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "+ Add asset"}</button>
      </div>

      {open && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="grid g-3" style={{ gap: 10, marginBottom: 10 }}>
            <div><label className="lbl">Name</label><input className="inp" placeholder="MacBook Air M2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="lbl">Type</label><select className="inp" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="lbl">Serial / ID</label><input className="inp" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></div>
            <div><label className="lbl">Provider / vendor</label><input className="inp" placeholder="e.g. Apple, Amazon" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} /></div>
            <div><label className="lbl">Assigned to</label><select className="inp" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}><option value="">— unassigned —</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="lbl">Status</label><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className="lbl">Purchase date</label><input className="inp" type="date" value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} /></div>
            <div style={{ gridColumn: "span 2" }}><label className="lbl">Notes (repairs, condition…)</label><input className="inp" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary" onClick={add} disabled={saving}>{saving ? "Adding…" : "Add asset"}</button>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select className="inp" value={ft} onChange={(e) => setFt(e.target.value)} style={{ maxWidth: 150, padding: "5px 8px", fontSize: 12.5 }}><option value="all">All types</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="inp" value={fs} onChange={(e) => setFs(e.target.value)} style={{ maxWidth: 150, padding: "5px 8px", fontSize: 12.5 }}><option value="all">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Asset</th><th>Serial</th><th>Provider</th><th>Assigned</th><th>Status</th><th style={{ textAlign: "right" }}></th></tr>
            </thead>
            <tbody>
              {view.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</div>
                    <div className="tiny faint">{a.type}{a.purchaseDate ? ` · ${a.purchaseDate}` : ""}</div>
                    {a.notes && <div className="tiny muted">{a.notes}</div>}
                  </td>
                  <td className="tiny num">{a.serial || "—"}</td>
                  <td className="tiny">{a.provider || "—"}</td>
                  <td>
                    <select className="inp" style={{ padding: "4px 6px", fontSize: 12, maxWidth: 130 }} value={a.assignedTo} disabled={busy === a.id} onChange={(e) => patch(a.id, { assignedTo: e.target.value })}>
                      <option value="">— unassigned —</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className={`inp pill ${STATUS[a.status] || "p-neut"}`} style={{ padding: "4px 8px", fontSize: 11.5, border: "none" }} value={a.status} disabled={busy === a.id} onChange={(e) => patch(a.id, { status: e.target.value })}>
                      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="chip" onClick={() => del(a.id)} disabled={busy === a.id} style={{ padding: "4px 8px", fontSize: 11 }}>✕</button>
                  </td>
                </tr>
              ))}
              {view.length === 0 && <tr><td colSpan={6} className="tiny faint" style={{ textAlign: "center", padding: 22 }}>No assets yet — add your first above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted tiny" style={{ marginTop: 10 }}>Tip: set status to <b>in-repair</b> and add the repair detail in Notes when a device goes to a vendor.</p>
    </>
  );
}
