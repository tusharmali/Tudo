"use client";

import { useState } from "react";
import { toast } from "./Toaster";

export default function CopyButton({
  text,
  label = "Copy",
  toastMsg = "Copied — paste into Teams",
}: {
  text: string;
  label?: string;
  toastMsg?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    setDone(true);
    toast(toastMsg);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button className={`copy-btn${done ? " done" : ""}`} onClick={copy} type="button">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {done ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
          </>
        )}
      </svg>
      {done ? "Copied" : label}
    </button>
  );
}
