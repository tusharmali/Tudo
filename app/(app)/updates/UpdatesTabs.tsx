"use client";

import { useState } from "react";
import MyDay from "./MyDay";
import DayPlanBuilder, { type BuilderUser } from "./DayPlanBuilder";
import OverallUpdate from "./OverallUpdate";
import WipComposer from "./WipComposer";
import type { TaskNode } from "@/lib/tasks";

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
  myTree,
  myWeekTarget,
  myWip,
  autoWip,
  date,
  admin,
}: {
  isAdmin: boolean;
  myTree: TaskNode[];
  myWeekTarget: string;
  myWip: string;
  autoWip: string;
  date: string;
  admin: AdminData | null;
}) {
  const tabs = isAdmin ? ["My Day", "Day Plan", "Overall Update", "WIP"] : ["My Day", "WIP"];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab${tab === t ? " on" : ""}`} onClick={() => setTab(t)} type="button">
            {t}
          </button>
        ))}
      </div>

      {tab === "My Day" && <MyDay tree={myTree} weekTarget={myWeekTarget} />}
      {tab === "WIP" && <WipComposer saved={myWip} autoWip={autoWip} date={date} />}
      {isAdmin && admin && tab === "Day Plan" && (
        <DayPlanBuilder
          users={admin.users}
          tasksByUser={admin.tasksByUser}
          weekTargets={admin.weekTargets}
          footer={admin.footer}
          dayPlanText={admin.dayPlanText}
        />
      )}
      {isAdmin && admin && tab === "Overall Update" && <OverallUpdate updatesText={admin.updatesText} aiOn={admin.aiOn} />}
    </>
  );
}
