/**
 * Which member notifications are switched on. Managers control these from the
 * Activity Log page; every notifyIfEnabled() call checks the matching key.
 * Default is ON — a missing setting means "notify".
 */
import { getSetting, setSetting, getSettings } from "./settings";

export interface NotifyAction {
  key: string;
  module: string;
  label: string;
}

/** The full catalogue of member-facing notifications, grouped by module. */
export const NOTIFY_ACTIONS: NotifyAction[] = [
  { key: "attendance.fix", module: "Attendance", label: "A manager fixes my attendance (undo check-out / clear the day)" },
  { key: "attendance.leave", module: "Attendance", label: "My leave / WFH request is approved, rejected or revoked" },
  { key: "people.role", module: "People", label: "My role is changed" },
  { key: "people.department", module: "People", label: "My department is changed" },
  { key: "people.reactivate", module: "People", label: "My account is reactivated" },
  { key: "people.password", module: "People", label: "A manager resets my password" },
  { key: "kudos.received", module: "Kudos", label: "I receive kudos" },
  { key: "chat.message", module: "Chat", label: "Someone sends me a message" },
  { key: "concern.raised", module: "Concerns", label: "A concern is raised with me" },
  { key: "concern.reply", module: "Concerns", label: "Someone replies on my concern" },
];

const KEYS = new Set(NOTIFY_ACTIONS.map((a) => a.key));
export function isNotifyKey(key: string): boolean {
  return KEYS.has(key);
}

export async function isNotifyEnabled(key: string): Promise<boolean> {
  return (await getSetting(`notify:${key}`, "on")) !== "off";
}

export async function setNotifyEnabled(key: string, on: boolean): Promise<void> {
  await setSetting(`notify:${key}`, on ? "on" : "off");
}

/** Current on/off state for every catalogued action (for the settings UI). */
export async function notifyPrefs(): Promise<Record<string, boolean>> {
  const s = await getSettings();
  const map: Record<string, boolean> = {};
  for (const a of NOTIFY_ACTIONS) map[a.key] = (s[`notify:${a.key}`] ?? "on") !== "off";
  return map;
}
