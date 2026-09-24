"use client";

type Row = { date: string; name: string; dept: string; start: string; end: string; durationMin: string; note: string };

export default function ExportBreaksButton({ rows, filename = "breaks.csv" }: { rows: Row[]; filename?: string }) {
  function download() {
    const head = ["Date", "Member", "Department", "Break start", "Break end", "Duration (min)", "Note"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(",")];
    for (const r of rows) {
      lines.push([r.date, r.name, r.dept, r.start, r.end || "ongoing", r.durationMin || "", r.note].map(esc).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="btn btn-ghost" type="button" onClick={download} disabled={rows.length === 0} style={{ padding: "8px 14px", fontSize: 13 }}>
      Export CSV
    </button>
  );
}
