"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import MyDay from "./MyDay";
import DayPlanBuilder, { type BuilderUser } from "./DayPlanBuilder";
import OverallUpdate from "./OverallUpdate";
import WipComposer from "./WipComposer";
import type { TaskNode } from "@/lib/tasks";
import type { WipSections } from "@/lib/format";

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
  date,
  today,
  myTree,
  myWeekTarget,
  savedWip,
  autoWip,
  admin,
}: {
  isAdmin: boolean;
  date: string;
  today: string;
  myTree: TaskNode[];
  myWeekTarget: string;
  savedWip: WipSections | null;
  autoWip: WipSections;
  admin: AdminData | null;
}) {
  const tabs = isAdmin ? ["My Day", "Day Plan", "Overall Update", "WIP"] : ["My Day", "WIP"];
  const [tab, setTab] = useState(tabs[0]);

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
      {tab === "WIP" && <WipComposer saved={savedWip} auto={autoWip} date={date} />}
      {isAdmin && admin && tab === "Day Plan" && (
        <DayPlanBuilder
          users={admin.users}
          tasksByUser={admin.tasksByUser}
          weekTargets={admin.weekTargets}
          footer={admin.footer}
          dayPlanText={admin.dayPlanText}
          date={date}
        />
      )}
      {isAdmin && admin && tab === "Overall Update" && <OverallUpdate updatesText={admin.updatesText} aiOn={admin.aiOn} date={date} />}
    </>
  );
}
