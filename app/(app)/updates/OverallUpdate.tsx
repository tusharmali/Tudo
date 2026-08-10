"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateOverallAction } from "@/app/actions/updates";
import { toast } from "@/components/Toaster";
import CopyButton from "@/components/CopyButton";

export default function OverallUpdate({ updatesText, aiOn, date }: { updatesText: string; aiOn: boolean; date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const r = await generateOverallAction({ date });
    if (r.ok) {
      toast(r.message || "Done");
      router.refresh();
    } else {
      toast(r.error || "Couldn't generate");
    }
    setBusy(false);
  }

  return (
    <>
      <div className="card pad ai-card" style={{ marginBottom: 18 }}>
        <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row">
            <span className="spark">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.9 4.6L19 9l-4.6 1.9L12 15l-1.9-4.1L5 9Z" />
              </svg>
            </span>
            <div>
              <h3 className="sec">Overall Update — drafted by AI</h3>
              <div className="tiny muted">Reads everyone&apos;s updates and writes the owner summary in your voice. Powered by OpenRouter.</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={busy || !aiOn}>
            {busy ? (
              <>
                <span className="spin" style={{ display: "inline-block" }}>◠</span> Reading…
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>
        {!aiOn && (
          <p className="tiny" style={{ margin: "10px 0 0", color: "var(--warn)" }}>
            Add <code>OPENROUTER_API_KEY</code> to your environment to enable AI drafting.
          </p>
        )}
      </div>

      <div className="copybox">
        <div className="cbar">
          <span className="cttl">Full compiled update — copy &amp; post</span>
          <CopyButton text={updatesText} />
        </div>
        <pre>{updatesText}</pre>
      </div>
    </>
  );
}
