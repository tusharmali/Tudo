"use client";

import { useState } from "react";
import { saveWipAction } from "@/app/actions/updates";
import { renderWip } from "@/lib/format";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";

export default function WipComposer({ saved, autoWip, date }: { saved: string; autoWip: string; date: string }) {
  const [content, setContent] = useState(saved || autoWip);
  const [busy, setBusy] = useState(false);
  const preview = renderWip(date, content || "");

  async function save() {
    setBusy(true);
    const r = await saveWipAction({ content });
    if (r.ok) toast(r.message || "Saved");
    else toast(r.error || "Error");
    setBusy(false);
  }

  function rebuild() {
    setContent(autoWip);
    toast(autoWip.trim() ? "Filled from today's tasks" : "No tasks to fill from yet");
  }

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <div className="between" style={{ marginBottom: 4 }}>
          <h3 className="sec">Compose WIP</h3>
          <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={rebuild} type="button">
            ↻ Rebuild from tasks
          </button>
        </div>
        <p className="muted tiny" style={{ margin: "0 0 14px" }}>
          Pre-filled from today&apos;s tasks with their status. Edit freely — the preview updates live.
        </p>
        <textarea
          className="inp"
          style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 13 }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"o Task one - Done\no Task two - In progress"}
        />
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>
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
