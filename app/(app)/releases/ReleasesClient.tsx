"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReleaseAction, deleteReleaseAction, updateReleaseStatusAction } from "@/app/actions/releases";
import { toast } from "@/components/Toaster";
import type { Release } from "@/lib/releases";

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "p-peri" },
  live: { label: "Live", cls: "p-warn" },
  shipped: { label: "Shipped", cls: "p-good" },
};

function dayMonth(iso: string): { d: string; m: string } {
  const parts = iso.split("-");
  const d = parts[2] || "–";
  const date = new Date(`${iso}T00:00:00`);
  const m = isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short" });
  return { d, m };
}
function parseResources(s: string): { label: string; url: string }[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("|");
      return i >= 0 ? { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() } : { label: l, url: l };
    });
}

export default function ReleasesClient({ releases, isAdmin }: { releases: Release[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", scheduledDate: "", status: "scheduled", points: "", resources: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!f.title.trim() || !f.scheduledDate) {
      toast("Add a title and date");
      return;
    }
    setBusy(true);
    const r = await createReleaseAction(f);
    if (r.ok) {
      toast(r.message || "Added");
      setF({ title: "", scheduledDate: "", status: "scheduled", points: "", resources: "" });
      setOpen(false);
      router.refresh();
    } else toast(r.error || "Error");
    setBusy(false);
  }
  async function del(id: string) {
    const r = await deleteReleaseAction({ id });
    if (r.ok) {
      toast(r.message || "Removed");
      router.refresh();
    } else toast(r.error || "Error");
  }
  async function setStatus(id: string, status: string) {
    const r = await updateReleaseStatusAction({ id, status });
    if (r.ok) router.refresh();
    else toast(r.error || "Error");
  }

  return (
    <>
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "+ Add release"}
          </button>
          {open && (
            <div className="card pad" style={{ marginTop: 12 }}>
              <div className="grid g-2" style={{ gap: 10, marginBottom: 10 }}>
                <input className="inp" placeholder="Title (e.g. This week's release)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                <input className="inp" type="date" value={f.scheduledDate} onChange={(e) => setF({ ...f, scheduledDate: e.target.value })} />
              </div>
              <textarea className="inp" placeholder={"Points — one per line\nAEO/GEO\nTaylor points"} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} style={{ minHeight: 90, marginBottom: 10 }} />
              <textarea className="inp" placeholder={"Resources — one per line as  Label|url\nJira board|https://…"} value={f.resources} onChange={(e) => setF({ ...f, resources: e.target.value })} style={{ minHeight: 70, marginBottom: 10 }} />
              <div className="row" style={{ gap: 10 }}>
                <select className="inp" style={{ maxWidth: 180 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live</option>
                  <option value="shipped">Shipped</option>
                </select>
                <button className="btn btn-primary" onClick={add} disabled={busy}>
                  {busy ? "Adding…" : "Add release"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {releases.length === 0 && (
        <div className="empty">
          <div className="t">No releases yet</div>
          <div className="s">{isAdmin ? "Add your first release above." : "Nothing scheduled right now."}</div>
        </div>
      )}

      {releases.map((rel) => {
        const st = STATUS[rel.status] || STATUS.scheduled;
        const dm = dayMonth(rel.scheduledDate);
        const pts = rel.points.split("\n").map((s) => s.trim()).filter(Boolean);
        const res = parseResources(rel.resources);
        return (
          <div className="rel" key={rel.id} style={rel.status === "shipped" ? { opacity: 0.75 } : undefined}>
            <div className="date">
              <div className="dd">{dm.d}</div>
              <div className="mm">{dm.m}</div>
            </div>
            <div className="rel-body">
              <div className="between">
                <div style={{ fontFamily: "var(--round)", fontWeight: 750, fontSize: 16 }}>{rel.title}</div>
                <span className={`pill ${st.cls}`}>
                  <span className="d" />
                  {st.label}
                </span>
              </div>
              {pts.length > 0 && (
                <ul>
                  {pts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {(res.length > 0 || isAdmin) && (
                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  {res.map((r, i) => (
                    <a key={i} className="chip link" href={r.url} target="_blank" rel="noopener noreferrer">
                      🔗 {r.label}
                    </a>
                  ))}
                  {isAdmin && (
                    <>
                      <select
                        className="inp"
                        style={{ maxWidth: 150, padding: "5px 10px", fontSize: 12 }}
                        value={rel.status}
                        onChange={(e) => setStatus(rel.id, e.target.value)}
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="live">Live</option>
                        <option value="shipped">Shipped</option>
                      </select>
                      <button className="chip" onClick={() => del(rel.id)} type="button">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
