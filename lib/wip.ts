import { allRows, appendRow, updateWhere, genId, todayStr } from "./db";

export async function getWip(userId: string, date = todayStr()): Promise<string> {
  const rows = await allRows("WIP");
  const r = rows.find((x) => x.userId === userId && x.date === date);
  return r?.content || "";
}

export async function setWip(userId: string, content: string, date = todayStr()): Promise<void> {
  const rows = await allRows("WIP");
  const existing = rows.find((x) => x.userId === userId && x.date === date);
  if (existing) {
    await updateWhere("WIP", (r) => r.userId === userId && r.date === date, { content });
  } else {
    await appendRow("WIP", { id: genId("wip"), userId, date, content, createdAt: new Date().toISOString() });
  }
}
