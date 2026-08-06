/**
 * Renders team data into the EXACT message formats the team posts to Teams.
 * Pure functions — safe to import on client or server.
 */
import type { TaskNode } from "./tasks";

const BORDER = "=".repeat(60);
const WIDE = "_".repeat(60);
const THIN = "_".repeat(23);

function fmtDate(iso: string, sep = "/"): string {
  const [y, m, d] = iso.split("-");
  return `${d}${sep}${m}${sep}${(y || "").slice(2)}`;
}
function fmtDM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Suffix that describes a task's status / update for update & WIP lines. */
function statusSuffix(t: { status: string; updateText: string }): string {
  const u = (t.updateText || "").trim();
  if (u) return ` - ${u}`;
  if (t.status === "done") return " - Done";
  if (t.status === "in-progress") return " - In progress";
  return "";
}

export interface PlanBlock {
  handle: string;
  nodes: TaskNode[];
  weekTarget: string;
}

export function renderDayPlan(date: string, blocks: PlanBlock[], footer = ""): string {
  const out: string[] = [BORDER, "", `DAY PLAN - ${fmtDate(date)}`, WIDE, ""];
  blocks.forEach((b, i) => {
    out.push(`*@${b.handle}*`);
    for (const n of b.nodes) {
      out.push(`o ${n.content}`);
      for (const c of n.children) out.push(`    - ${c.content}`);
    }
    if (b.weekTarget.trim()) out.push(`Week Target: ${b.weekTarget.trim()}`);
    if (i < blocks.length - 1) out.push(THIN, "");
  });
  out.push(WIDE, "");
  if (footer.trim()) out.push(footer.trim(), "");
  out.push(BORDER);
  return out.join("\n");
}

export interface UpdateBlock {
  name: string;
  nodes: TaskNode[];
}

export function renderUpdates(date: string, blocks: UpdateBlock[], overall = ""): string {
  const out: string[] = [`Updates: ${fmtDM(date)}`, ""];
  for (const b of blocks) {
    out.push(b.name);
    for (const n of b.nodes) {
      const txt = n.updateText.trim() || `${n.content}${n.status === "done" ? " - Done" : n.status === "in-progress" ? " - In progress" : ""}`;
      out.push(`o ${txt}`);
      for (const c of n.children) out.push(`  - ${c.updateText.trim() || c.content}`);
    }
    out.push("");
  }
  out.push("-----------------------------------------------", "", "Overall Update", overall.trim());
  return out.join("\n");
}

/** Build the WIP body straight from a person's task tree, showing status. */
export function wipBodyFromTasks(nodes: TaskNode[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    lines.push(`o ${n.content}${statusSuffix(n)}`);
    for (const c of n.children) lines.push(`     - ${c.content}${statusSuffix(c)}`);
  }
  return lines.join("\n");
}

export function renderWip(date: string, content: string): string {
  return [`WIP ${fmtDate(date, "-")}`, "", "", content.trim(), "", "", "Signing off!"].join("\n");
}
