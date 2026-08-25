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

function statusLabel(s: string): string {
  return s === "done" ? "Done" : s === "in-progress" ? "In progress" : "Pending";
}

/** One task line: "<bullet> <name> — <written update> [Status]". */
function taskLine(bullet: string, content: string, updateText: string, status: string): string {
  const upd = (updateText || "").trim();
  return `${bullet} ${content}${upd ? ` — ${upd}` : ""} [${statusLabel(status)}]`;
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
      out.push(taskLine("o", n.content, n.updateText, n.status));
      for (const c of n.children) out.push(taskLine("  -", c.content, c.updateText, c.status));
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

/** Pre-fill the WIP sections from a person's tasks for the day.
 *  Sub-tasks stay nested under their parent, and every line reads
 *  "<name> — <update> [Status]". A parent shows in a section if it, or
 *  any of its children, belongs there — carrying only the matching kids. */
export function autoWipSections(nodes: TaskNode[]): WipSections {
  const worked: string[] = [];
  const pending: string[] = [];
  const isWorked = (s: string) => s === "done" || s === "in-progress";
  const isPending = (s: string) => s === "pending" || s === "in-progress";

  for (const n of nodes) {
    const workedKids = n.children.filter((c) => isWorked(c.status));
    const pendingKids = n.children.filter((c) => isPending(c.status));

    if (isWorked(n.status) || workedKids.length) {
      worked.push(taskLine("-", n.content, n.updateText, n.status));
      for (const c of workedKids) worked.push(taskLine("  -", c.content, c.updateText, c.status));
    }
    if (isPending(n.status) || pendingKids.length) {
      pending.push(taskLine("-", n.content, n.updateText, n.status));
      for (const c of pendingKids) pending.push(taskLine("  -", c.content, c.updateText, c.status));
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
