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

// ---------- Day Plan ----------
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

// ---------- Updates ----------
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

// ---------- WIP (structured, editable sections) ----------
export interface WipSections {
  worked: string;
  pending: string;
  blockers: string;
  plan: string;
}

export const EMPTY_WIP: WipSections = { worked: "", pending: "", blockers: "", plan: "" };

/** Pre-fill the WIP sections from a person's tasks for the day. */
export function autoWipSections(nodes: TaskNode[]): WipSections {
  const worked: string[] = [];
  const pending: string[] = [];
  for (const t of nodes.flatMap((n) => [n, ...n.children])) {
    const upd = t.updateText.trim();
    if (t.status === "done" || t.status === "in-progress") {
      const suffix = upd ? ` - ${upd}` : t.status === "in-progress" ? " [in-progress]" : "";
      worked.push(`- ${t.content}${suffix}`);
    }
    if (t.status === "pending" || t.status === "in-progress") {
      pending.push(`- ${t.content}`);
    }
  }
  return {
    worked: worked.join("\n"),
    pending: pending.join("\n"),
    blockers: "- N/A",
    plan: "- Task as per assigned and bugs if any",
  };
}

/** Parse the sections back out of a stored WIP cell (JSON). Returns null for legacy/plain text. */
export function parseWipSections(raw: string): WipSections | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<WipSections>;
    if (o && typeof o === "object" && ("worked" in o || "pending" in o || "blockers" in o || "plan" in o)) {
      return {
        worked: String(o.worked ?? ""),
        pending: String(o.pending ?? ""),
        blockers: String(o.blockers ?? ""),
        plan: String(o.plan ?? ""),
      };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export function renderWip(date: string, s: WipSections): string {
  const block = (title: string, body: string, fallback: string): string[] => [title, body.trim() || fallback];
  return [
    `WIP ${fmtDate(date, "-")}`,
    "",
    ...block("Tasks worked on (with brief output):", s.worked, "- "),
    "",
    ...block("Pending/In Progress:", s.pending, "- N/A"),
    "",
    ...block("Blockers (if any):", s.blockers, "- N/A"),
    "",
    ...block("Plan for tomorrow:", s.plan, "- Task as per assigned and bugs if any"),
    "",
    "Signing off",
  ].join("\n");
}
