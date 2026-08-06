import { allRows, appendRow, genId } from "./db";

export interface Chat {
  id: string;
  type: string; // dm | group
  name: string;
  department: string;
  memberIds: string; // comma-separated
  createdBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  fromUserId: string;
  content: string;
  createdAt: string;
}

async function allChats(): Promise<Chat[]> {
  return (await allRows("Chats")) as unknown as Chat[];
}

function members(c: Chat): string[] {
  return c.memberIds.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function listForUser(userId: string): Promise<Chat[]> {
  return (await allChats()).filter((c) => members(c).includes(userId));
}

export async function getChat(id: string): Promise<Chat | null> {
  return (await allChats()).find((c) => c.id === id) ?? null;
}

export async function isMember(chatId: string, userId: string): Promise<boolean> {
  const c = await getChat(chatId);
  return !!c && members(c).includes(userId);
}

export async function createGroup(name: string, department: string, memberIds: string[], createdBy: string): Promise<string> {
  const id = genId("gc");
  const unique = Array.from(new Set([...memberIds, createdBy])).filter(Boolean);
  await appendRow("Chats", {
    id,
    type: "group",
    name,
    department: department || "",
    memberIds: unique.join(","),
    createdBy,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function ensureDm(a: string, b: string): Promise<string> {
  const key = [a, b].sort().join(",");
  const existing = (await allChats()).find((c) => c.type === "dm" && members(c).sort().join(",") === key);
  if (existing) return existing.id;
  const id = genId("dm");
  await appendRow("Chats", {
    id,
    type: "dm",
    name: "",
    department: "",
    memberIds: key,
    createdBy: a,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getMessages(chatId: string, sinceIso?: string): Promise<Message[]> {
  const rows = (await allRows("Messages")) as unknown as Message[];
  return rows
    .filter((m) => m.chatId === chatId && (!sinceIso || m.createdAt > sinceIso))
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

export async function sendMessage(chatId: string, fromUserId: string, content: string): Promise<void> {
  await appendRow("Messages", {
    id: genId("msg"),
    chatId,
    fromUserId,
    content,
    createdAt: new Date().toISOString(),
  });
}
