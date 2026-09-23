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
function fmtMDY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${(y || "").slice(2)}`;
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

// ---------- WIP · Digi (per-task, with time + status) ----------
export interface DigiTask {
  name: string;
  time: string; // e.g. "1 Hour 57 Minutes"
  notes: string; // one bullet per line
  status: string; // Completed | In progress | …
}
export interface DigiWip {
  signIn: string; // e.g. "10:13 AM"
  total: string; // total duration, e.g. "08 Hours 47 Minutes"
  tasks: DigiTask[];
}
export const DIGI_STATUSES = ["Completed", "In progress", "On hold"];
export const EMPTY_DIGI: DigiWip = {
  signIn: "",
  total: "",
  tasks: [{ name: "", time: "", notes: "", status: "Completed" }],
};

export function renderDigiWip(date: string, w: DigiWip): string {
  const out: string[] = [`WIP Report – ${fmtDate(date, "-")}`, ""];
  out.push(`Signing In: ${w.signIn.trim() || "—"}`, "");
  out.push(`Total Duration: ${w.total.trim() || "—"}`, "");
  out.push("Tasks Worked On:", "");
  w.tasks
    .filter((t) => t.name.trim())
    .forEach((t, i) => {
      out.push(`${i + 1}. ${t.name.trim()}${t.time.trim() ? ` – ${t.time.trim()}` : ""}`);
      for (const line of t.notes.split("\n").map((l) => l.trim()).filter(Boolean)) out.push(`   - ${line}`);
      if (t.status.trim()) out.push(`   Status: ${t.status.trim()}`);
      out.push("");
    });
  out.push("Signing off");
  return out.join("\n");
}

// ---------- WIP · Support (bucket counts) ----------
export interface Bucket {
  label: string;
  count: string;
}
export interface SupportWip {
  title: string; // header prefix, e.g. "Total" or "WIP"
  buckets: Bucket[];
  note: string; // free line(s) before sign-off, e.g. "Checked my TD's"
}
/** Every bucket Support counts (union of the team's posted formats). Members
 *  fill only the ones they have; blank counts are dropped when posting. */
export const SUPPORT_BUCKETS = [
  "Ticket",
  "Male CC",
  "Female CC",
  "Male enrollment",
  "Female enrollment",
  "Chat",
  "Email",
  "VS",
  "Spiro CC",
  "Doxy CC",
  "Re-open window",
  "P/T reminder",
  "Flup reminder",
];
export const EMPTY_SUPPORT: SupportWip = {
  title: "Total",
  buckets: SUPPORT_BUCKETS.map((label) => ({ label, count: "" })),
  note: "Checked my TD's",
};

export function renderSupportWip(date: string, w: SupportWip): string {
  const out: string[] = [`${w.title.trim() || "Total"} ${fmtMDY(date)}`, ""];
  for (const b of w.buckets) {
    if (!b.label.trim() || b.count.trim() === "") continue;
    out.push(`${b.label.trim()} - ${b.count.trim()}`);
  }
  out.push("");
  if (w.note.trim()) out.push(w.note.trim(), "");
  out.push("Signing off!");
  return out.join("\n");
}

// ---------- WIP · stored shape (discriminated union) ----------
export type WipData =
  | ({ format: "tech" } & WipSections)
  | ({ format: "digi" } & DigiWip)
  | ({ format: "support" } & SupportWip);

export type WipFormat = WipData["format"];

/** Which composer a department uses. Everything else falls back to the manual "tech" sections. */
export function wipFormatForDept(dept: string): WipFormat {
  if (dept === "Digi") return "digi";
  if (dept === "Support") return "support";
  return "tech";
}

export function parseDigiWip(raw: string): DigiWip | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { format?: string; signIn?: string; total?: string; tasks?: unknown };
    if (o?.format !== "digi") return null;
    const tasks = Array.isArray(o.tasks) ? o.tasks : [];
    return {
      signIn: String(o.signIn ?? ""),
      total: String(o.total ?? ""),
      tasks: tasks.map((t) => {
        const x = (t || {}) as Record<string, unknown>;
        return { name: String(x.name ?? ""), time: String(x.time ?? ""), notes: String(x.notes ?? ""), status: String(x.status ?? "Completed") };
      }),
    };
  } catch {
    return null;
  }
}

export function parseSupportWip(raw: string): SupportWip | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { format?: string; title?: string; buckets?: unknown; note?: string };
    if (o?.format !== "support") return null;
    const buckets = Array.isArray(o.buckets) ? o.buckets : [];
    return {
      title: String(o.title ?? "Total"),
      buckets: buckets.map((b) => {
        const x = (b || {}) as Record<string, unknown>;
        return { label: String(x.label ?? ""), count: String(x.count ?? "") };
      }),
      note: String(o.note ?? ""),
    };
  } catch {
    return null;
  }
}
