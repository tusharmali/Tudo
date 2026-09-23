"use client";

import { useEffect, useState } from "react";
import { saveWipAction } from "@/app/actions/updates";
import { renderSupportWip, parseSupportWip, EMPTY_SUPPORT, type SupportWip } from "@/lib/format";
import { toast } from "@/components/Toaster";
import WipEditablePreview from "./WipEditablePreview";

export default function SupportWipComposer({ raw, date }: { raw: string; date: string }) {
  const [w, setW] = useState<SupportWip>(parseSupportWip(raw) || EMPTY_SUPPORT);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setW(parseSupportWip(raw) || EMPTY_SUPPORT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const preview = renderSupportWip(date, w);
  const filled = w.buckets.filter((b) => b.count.trim() !== "").length;

  function patch(i: number, p: Partial<{ label: string; count: string }>) {
    setW((prev) => ({ ...prev, buckets: prev.buckets.map((b, j) => (j === i ? { ...b, ...p } : b)) }));
  }
  function addBucket() {
    setW((prev) => ({ ...prev, buckets: [...prev.buckets, { label: "", count: "" }] }));
  }
  function removeBucket(i: number) {
    setW((prev) => ({ ...prev, buckets: prev.buckets.filter((_, j) => j !== i) }));
  }

  async function save() {
    setBusy(true);
    const r = await saveWipAction({ date, data: { format: "support", ...w } });
    if (r.ok) toast(r.message || "Saved");
    else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <div className="between" style={{ marginBottom: 12 }}>
          <h3 className="sec" style={{ margin: 0 }}>Compose WIP · Support</h3>
          <span className="tiny faint">{filled} counted</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="lbl">Header</label>
          <input className="inp" style={{ maxWidth: 220 }} value={w.title} placeholder="Total" onChange={(e) => setW({ ...w, title: e.target.value })} />
          <span className="tiny faint" style={{ marginLeft: 8 }}>shows as “{(w.title.trim() || "Total")} {date.split("-").slice(1).reverse().join("/")}/{date.slice(2, 4)}”</span>
        </div>

        <label className="lbl">Counts — leave blank to skip a row when posting</label>
        <div style={{ marginBottom: 12 }}>
          {w.buckets.map((b, i) => (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 6 }}>
              <input
                className="inp"
                style={{ flex: 1 }}
                value={b.label}
                placeholder="Bucket name"
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              <input
                className="inp"
                style={{ width: 84, textAlign: "center" }}
                inputMode="numeric"
                value={b.count}
                placeholder="—"
                onChange={(e) => patch(i, { count: e.target.value.replace(/[^\d]/g, "") })}
              />
              <button className="chip" type="button" onClick={() => removeBucket(i)} style={{ padding: "6px 9px", fontSize: 11 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" type="button" onClick={addBucket} style={{ padding: "7px 12px", fontSize: 12.5, marginBottom: 14 }}>
          + Add bucket
        </button>

        <div style={{ marginBottom: 14 }}>
          <label className="lbl">Closing note</label>
          <input className="inp" value={w.note} placeholder="Checked my TD's" onChange={(e) => setW({ ...w, note: e.target.value })} />
        </div>

        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save WIP"}
        </button>
      </div>

      <WipEditablePreview text={preview} resetKey={date} />
    </div>
  );
}
