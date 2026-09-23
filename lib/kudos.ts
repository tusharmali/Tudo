import { allRows, appendRow, deleteWhere, genId } from "./db";

export interface Kudo {
  id: string;
  fromUserId: string;
  toUserId: string;
  category: string;
  message: string;
  createdAt: string;
}

export const KUDO_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: "team-player", label: "Team Player", emoji: "🤝" },
  { key: "above-beyond", label: "Above & Beyond", emoji: "🚀" },
  { key: "bug-squasher", label: "Bug Squasher", emoji: "🐞" },
  { key: "great-idea", label: "Great Idea", emoji: "💡" },
  { key: "clutch-save", label: "Clutch Save", emoji: "🦸" },
  { key: "kind-soul", label: "Kind Soul", emoji: "💛" },
];

export function categoryMeta(key: string): { key: string; label: string; emoji: string } {
  return KUDO_CATEGORIES.find((c) => c.key === key) || { key, label: "Kudos", emoji: "🎉" };
}

export async function listKudos(): Promise<Kudo[]> {
  return ((await allRows("Kudos")) as unknown as Kudo[]).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function giveKudo(fromUserId: string, toUserId: string, category: string, message: string): Promise<void> {
  await appendRow("Kudos", {
    id: genId("kd"),
    fromUserId,
    toUserId,
    category,
    message,
    createdAt: new Date().toISOString(),
  });
}

export async function getKudo(id: string): Promise<Kudo | null> {
  return (await listKudos()).find((k) => k.id === id) ?? null;
}

export async function removeKudo(id: string): Promise<void> {
  await deleteWhere("Kudos", (r) => r.id === id);
}
