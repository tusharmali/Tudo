"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type CmdItem = { href: string; label: string; icon?: ReactNode; section?: string };

/**
 * ⌘K / Ctrl-K quick switcher. Type a few letters and jump to any screen you can
 * reach. Pure client-side over the nav items Shell already computes — no extra
 * data fetch. Fully keyboard-driven (↑ ↓ Enter Esc) and touch-friendly.
 */
export default function CommandPalette({
  open,
  onClose,
  items,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  items: CmdItem[];
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const scored = items
      .map((it) => {
        const l = it.label.toLowerCase();
        const sec = (it.section || "").toLowerCase();
        let score = -1;
        if (l === q) score = 0;
        else if (l.startsWith(q)) score = 1;
        else if (l.includes(q)) score = 2;
        else if (sec.includes(q)) score = 3;
        return { it, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score);
    return scored.map((x) => x.it);
  }, [query, items]);

  // Reset to a clean state each time it opens, and focus the field.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const go = (href?: string) => {
    if (href) onNavigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]?.href); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Quick search">
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-head">
          <svg className="cmdk-ic" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-3.5-3.5" /></svg>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search screens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmdk-empty">No matches for “{query}”.</div>
          ) : (
            results.map((it, i) => (
              <button
                key={it.href}
                data-i={i}
                type="button"
                className={`cmdk-item${i === active ? " on" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
              >
                <span className="cmdk-item-ic">{it.icon}</span>
                <span className="cmdk-item-label">{it.label}</span>
                {it.section && <span className="cmdk-item-sec">{it.section}</span>}
              </button>
            ))
          )}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
