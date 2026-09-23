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
import { wipFormatForDept, type WipSections } from "@/lib/format";

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
  dept = "",
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
  date: string;
  today: string;
  myTree: TaskNode[];
  myWeekTarget: string;
  savedWip: WipSections | null;
  savedWipRaw?: string;
  autoWip: WipSections;
  admin: AdminData | null;
}) {
  const canPlan = isAdmin || isDeptAdmin;
  const tabs = ["My Day", ...(canPlan ? ["Day Plan"] : []), ...(isAdmin ? ["Overall Update"] : []), "WIP"];
  const [tab, setTab] = useState(tabs[0]);
  const wipFormat = wipFormatForDept(dept);

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
      {tab === "WIP" && wipFormat === "digi" && <DigiWipComposer raw={savedWipRaw} date={date} />}
      {tab === "WIP" && wipFormat === "support" && <SupportWipComposer raw={savedWipRaw} date={date} />}
      {tab === "WIP" && wipFormat === "tech" && <WipComposer saved={savedWip} auto={autoWip} date={date} />}
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
