"use client";

import { useEffect, useState } from "react";
import { saveWipAction } from "@/app/actions/updates";
import { renderWip, type WipSections } from "@/lib/format";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";

const FIELDS: { key: keyof WipSections; label: string; ph: string }[] = [
  { key: "worked", label: "Tasks worked on (with brief output)", ph: "- Task — brief output" },
  { key: "pending", label: "Pending / In Progress", ph: "- Task still open" },
  { key: "blockers", label: "Blockers (if any)", ph: "- N/A" },
  { key: "plan", label: "Plan for tomorrow", ph: "- Task as per assigned and bugs if any" },
];

export default function WipComposer({ saved, auto, date }: { saved: WipSections | null; auto: WipSections; date: string }) {
  const [s, setS] = useState<WipSections>(saved || auto);
  const [busy, setBusy] = useState(false);

  // Reset when the day changes.
  useEffect(() => {
    setS(saved || auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const preview = renderWip(date, s);

  async function save() {
    setBusy(true);
    const r = await saveWipAction({ date, sections: s });
    if (r.ok) toast(r.message || "Saved");
    else toast(r.error || "Error");
    setBusy(false);
  }

  function rebuild() {
    setS(auto);
    toast("Filled from this day's tasks");
  }

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <div className="between" style={{ marginBottom: 12 }}>
          <h3 className="sec">Compose WIP</h3>
          <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={rebuild} type="button">
            ↻ Rebuild from tasks
          </button>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label className="lbl">{f.label}</label>
            <textarea
              className="inp"
              style={{ minHeight: 68, fontFamily: "var(--mono)", fontSize: 12.5 }}
              value={s[f.key]}
              placeholder={f.ph}
              onChange={(e) => setS({ ...s, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save WIP"}
        </button>
      </div>
      <div className="copybox" style={{ alignSelf: "start" }}>
        <div className="cbar">
          <span className="cttl">WIP — ready to post</span>
          <CopyButton text={preview} />
        </div>
        <pre>{preview}</pre>
      </div>
    </div>
  );
}
