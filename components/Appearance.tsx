"use client";

import { useEffect, useRef, useState } from "react";

const ACCENTS = [
  { key: "indigo", color: "#7178dd" }, { key: "teal", color: "#3fa98a" },
  { key: "rose", color: "#de7c9a" }, { key: "amber", color: "#cf8f4a" },
  { key: "violet", color: "#9b7ad6" }, { key: "sky", color: "#4f97d6" },
];
type Mode = "system" | "light" | "dark";

function applyTheme(mode: Mode) {
  const d = document.documentElement;
  const t = mode === "system" ? (window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light") : mode;
  d.setAttribute("data-theme", t);
  try { if (mode === "system") localStorage.removeItem("tudo-theme"); else localStorage.setItem("tudo-theme", mode); } catch { /* ignore */ }
}
function applyAccent(a: string) {
  const d = document.documentElement;
  try {
    if (a === "indigo") { d.removeAttribute("data-accent"); localStorage.removeItem("tudo-accent"); }
    else { d.setAttribute("data-accent", a); localStorage.setItem("tudo-accent", a); }
  } catch { /* ignore */ }
}

export default function Appearance({ variant = "button" }: { variant?: "button" | "sheet" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("system");
  const [accent, setAccent] = useState("indigo");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tudo-theme");
      setMode(t === "light" || t === "dark" ? t : "system");
      setAccent(localStorage.getItem("tudo-accent") || "indigo");
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const controls = (
    <>
      <div className="appear-lbl">Theme</div>
      <div className="seg3">
        {(["system", "light", "dark"] as Mode[]).map((m) => (
          <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => { setMode(m); applyTheme(m); }}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <div className="appear-lbl">Accent colour</div>
      <div className="swatches">
        {ACCENTS.map((a) => (
          <button key={a.key} type="button" className={`swatch${accent === a.key ? " on" : ""}`} style={{ background: a.color }} title={a.key} aria-label={`${a.key} accent`} onClick={() => { setAccent(a.key); applyAccent(a.key); }} />
        ))}
      </div>
    </>
  );

  if (variant === "sheet") return <div className="sheet-appear" style={{ display: "block" }}>{controls}</div>;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button className="icon-btn" type="button" onClick={() => setOpen((v) => !v)} title="Appearance" aria-label="Appearance">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.75-.44-1.03-.24-.28-.44-.62-.44-1.02 0-.8.67-1.45 1.5-1.45H16a4 4 0 0 0 4-4c0-4.42-3.58-8-8-8Z" />
          <circle cx="7.5" cy="11.5" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16.5" cy="11.5" r="1" />
        </svg>
      </button>
      {open && <div className="appear-pop">{controls}</div>}
    </div>
  );
}
