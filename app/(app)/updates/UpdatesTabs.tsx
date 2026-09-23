"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import MyDay from "./MyDay";
import DayPlanBuilder, { type BuilderUser } from "./DayPlanBuilder";
import OverallUpdate from "./OverallUpdate";
import WipComposer from "./WipComposer";
import DigiWipComposer from "./DigiWipComposer";
import SupportWipComposer from "./SupportWipComposer";
import type { TaskNode } from "@/lib/tasks";
import { type WipSections, type WipFormat } from "@/lib/format";

const FMT_LABEL: Record<WipFormat, string> = { tech: "Tech", digi: "Digi", support: "Support" };

function savedFormat(raw: string): WipFormat | null {
  try {
    const o = JSON.parse(raw) as { format?: WipFormat; worked?: string };
    if (o?.format) return o.format;
    if (o && "worked" in o) return "tech";
  } catch {
    /* not JSON */
  }
  return null;
}

export interface AdminData {
  users: BuilderUser[];
  tasksByUser: Record<string, TaskNode[]>;
  weekTargets: Record<string, string>;
  footer: string;
  dayPlanText: string;
  updatesText: string;
  aiOn: boolean;
}

export default function UpdatesTabs({
  isAdmin,
  isDeptAdmin = false,
  wipFormats = ["tech"],
  date,
  today,
  myTree,
  myWeekTarget,
  savedWip,
  savedWipRaw = "",
  autoWip,
  admin,
}: {
  isAdmin: boolean;
  isDeptAdmin?: boolean;
  dept?: string;
  wipFormats?: WipFormat[];
  date: string;
  today: string;
  myTree: TaskNode[];
  myWeekTarget: string;
  savedWip: WipSections | null;
  savedWipRaw?: string;
  autoWip: WipSections;
  admin: AdminData | null;
}) {
  // A day-plan editor is anyone the server built admin data for.
  const canPlan = isAdmin || isDeptAdmin || !!admin;
  const tabs = ["My Day", ...(canPlan ? ["Day Plan"] : []), ...(isAdmin ? ["Overall Update"] : []), "WIP"];
  const [tab, setTab] = useState(tabs[0]);
  const saved = savedFormat(savedWipRaw);
  const [wipFmt, setWipFmt] = useState<WipFormat>(saved && wipFormats.includes(saved) ? saved : wipFormats[0]);

  return (
    <>
      <DatePicker date={date} today={today} />

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)} type="button">
            {t}
          </button>
        ))}
      </div>

      {tab === "My Day" && <MyDay tree={myTree} weekTarget={myWeekTarget} />}
      {tab === "WIP" && (
        <>
          {wipFormats.length > 1 && (
            <div className="seg" style={{ marginBottom: 14, display: "inline-flex" }}>
              {wipFormats.map((f) => (
                <button key={f} type="button" className={wipFmt === f ? "on" : ""} onClick={() => setWipFmt(f)}>
                  {FMT_LABEL[f]} WIP
                </button>
              ))}
            </div>
          )}
          {wipFmt === "digi" && <DigiWipComposer raw={savedWipRaw} date={date} />}
          {wipFmt === "support" && <SupportWipComposer raw={savedWipRaw} date={date} />}
          {wipFmt === "tech" && <WipComposer saved={savedWip} auto={autoWip} date={date} />}
        </>
      )}
      {canPlan && admin && tab === "Day Plan" && (
        <DayPlanBuilder
          users={admin.users}
          tasksByUser={admin.tasksByUser}
          weekTargets={admin.weekTargets}
          footer={admin.footer}
          dayPlanText={admin.dayPlanText}
          date={date}
          canEditFooter={isAdmin}
        />
      )}
      {isAdmin && admin && tab === "Overall Update" && <OverallUpdate updatesText={admin.updatesText} aiOn={admin.aiOn} date={date} />}
    </>
  );
}
