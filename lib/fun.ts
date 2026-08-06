import { allRows, appendRow, genId } from "./db";
import { getSettings, setSetting } from "./settings";

export interface Contribution {
  id: string;
  activityId: string;
  userId: string;
  content: string;
  createdAt: string;
}

/** Google Sheets coerces "true"/"false" to booleans and reads them back as
 *  "TRUE"/"FALSE", so parse tolerantly. */
export function isTruthy(v: string | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

export async function getFunState(): Promise<{ enabled: boolean; title: string }> {
  const s = await getSettings();
  return { enabled: isTruthy(s["fun.enabled"]), title: s["fun.title"] || "Two Truths & a Lie" };
}

export async function setFunEnabled(on: boolean): Promise<void> {
  await setSetting("fun.enabled", on ? "true" : "false");
}

export async function setFunTitle(title: string): Promise<void> {
  await setSetting("fun.title", title);
}

export async function listContributions(): Promise<Contribution[]> {
  return ((await allRows("FunContributions")) as unknown as Contribution[]).reverse();
}

export async function addContribution(userId: string, content: string): Promise<void> {
  await appendRow("FunContributions", {
    id: genId("fc"),
    activityId: "current",
    userId,
    content,
    createdAt: new Date().toISOString(),
  });
}
