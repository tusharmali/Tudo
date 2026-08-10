"use client";

import { useRouter } from "next/navigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shift(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default function DatePicker({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const isToday = date === today;
  const [yy, mm, dd] = date.split("-");
  const label = `${dd} ${MONTHS[Number(mm) - 1] || ""} ${yy}`;

  function go(d: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    router.push(d === today ? "/updates" : `/updates?date=${d}`);
  }

  return (
    <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <button className="icon-btn" onClick={() => go(shift(date, -1))} title="Previous day" type="button">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <input
        className="inp"
        type="date"
        value={date}
        onChange={(e) => go(e.target.value)}
        style={{ width: "auto", maxWidth: 190 }}
        aria-label="Pick a date"
      />
      <button className="icon-btn" onClick={() => go(shift(date, 1))} title="Next day" type="button">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      </button>
      <span className="pill p-peri">{isToday ? "Today" : label}</span>
      {!isToday && (
        <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => go(today)} type="button">
          Jump to today
        </button>
      )}
    </div>
  );
}
