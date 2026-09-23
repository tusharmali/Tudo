"use client";

import { useEffect, useState } from "react";
import { saveWipAction } from "@/app/actions/updates";
import { renderDigiWip, parseDigiWip, EMPTY_DIGI, DIGI_STATUSES, type DigiWip, type DigiTask } from "@/lib/format";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";

const blankTask = (): DigiTask => ({ name: "", time: "", notes: "", status: "Completed" });

export default function DigiWipComposer({ raw, date }: { raw: string; date: string }) {
  const [w, setW] = useState<DigiWip>(parseDigiWip(raw) || EMPTY_DIGI);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setW(parseDigiWip(raw) || EMPTY_DIGI);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const preview = renderDigiWip(date, w);

  function patchTask(i: number, patch: Partial<DigiTask>) {
    setW((prev) => ({ ...prev, tasks: prev.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }
  function addTask() {
    setW((prev) => ({ ...prev, tasks: [...prev.tasks, blankTask()] }));
  }
  function removeTask(i: number) {
    setW((prev) => ({ ...prev, tasks: prev.tasks.length > 1 ? prev.tasks.filter((_, j) => j !== i) : prev.tasks }));
  }

  async function save() {
    setBusy(true);
    const r = await saveWipAction({ date, data: { format: "digi", ...w } });
    if (r.ok) toast(r.message || "Saved");
    else toast(r.error || "Error");
    setBusy(false);
  }

  return (
    <div className="grid g-2-1">
      <div className="card pad">
        <h3 className="sec" style={{ marginBottom: 12 }}>Compose WIP · Digi</h3>

        <div className="grid g-2" style={{ gap: 10, marginBottom: 16 }}>
          <div>
            <label className="lbl">Signing In</label>
            <input className="inp" placeholder="10:13 AM" value={w.signIn} onChange={(e) => setW({ ...w, signIn: e.target.value })} />
          </div>
          <div>
            <label className="lbl">Total Duration</label>
            <input className="inp" placeholder="08 Hours 47 Minutes" value={w.total} onChange={(e) => setW({ ...w, total: e.target.value })} />
          </div>
        </div>

        <label className="lbl">Tasks worked on</label>
        {w.tasks.map((t, i) => (
          <div key={i} className="card pad" style={{ marginBottom: 10, background: "var(--surface-2, transparent)" }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="tiny faint num">#{i + 1}</span>
              <button className="chip" type="button" onClick={() => removeTask(i)} disabled={w.tasks.length <= 1} style={{ padding: "3px 9px", fontSize: 11 }}>
                Remove
              </button>
            </div>
            <div className="grid g-2" style={{ gap: 10, marginBottom: 8 }}>
              <input className="inp" placeholder="Task name — e.g. Bombay Jewels Post" value={t.name} onChange={(e) => patchTask(i, { name: e.target.value })} />
              <input className="inp" placeholder="Time — e.g. 1 Hour 57 Minutes" value={t.time} onChange={(e) => patchTask(i, { time: e.target.value })} />
            </div>
            <textarea
              className="inp"
              style={{ minHeight: 60, fontSize: 12.5, marginBottom: 8 }}
              placeholder={"What you did — one point per line\n- Developed and refined the creative layout"}
              value={t.notes}
              onChange={(e) => patchTask(i, { notes: e.target.value })}
            />
            <select className="inp" style={{ maxWidth: 200 }} value={t.status} onChange={(e) => patchTask(i, { status: e.target.value })}>
              {DIGI_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
        <button className="btn btn-ghost" type="button" onClick={addTask} style={{ padding: "7px 12px", fontSize: 12.5, marginBottom: 14 }}>
          + Add task
        </button>

        <div>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save WIP"}
          </button>
        </div>
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
