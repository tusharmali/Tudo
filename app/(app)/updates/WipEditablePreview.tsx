"use client";

import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";

/** The generated WIP text, shown in an EDITABLE box so anyone can tweak it
 *  before copying. Follows the form output until you type; then it keeps your
 *  edits (with a Reset to pull the freshly generated text back). */
export default function WipEditablePreview({ text, resetKey }: { text: string; resetKey?: string }) {
  const [override, setOverride] = useState<string | null>(null);

  // Drop manual edits when the day (or format) changes.
  useEffect(() => {
    setOverride(null);
  }, [resetKey]);

  const value = override !== null ? override : text;
  const edited = override !== null && override !== text;

  return (
    <div className="copybox" style={{ alignSelf: "start" }}>
      <div className="cbar">
        <span className="cttl">WIP — edit if needed, then copy</span>
        <div className="row" style={{ gap: 6 }}>
          {edited && (
            <button className="chip" type="button" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => setOverride(null)} title="Discard edits, regenerate from the form">
              ↻ Reset
            </button>
          )}
          <CopyButton text={value} />
        </div>
      </div>
      <textarea className="wip-edit" value={value} onChange={(e) => setOverride(e.target.value)} spellCheck={false} />
    </div>
  );
}
