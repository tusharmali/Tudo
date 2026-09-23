import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";
import { getSetting, setSetting, getSettings } from "./settings";

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

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ChatOverview {
  chatId: string;
  lastText: string;
  lastAt: string;
  lastFrom: string;
  unread: number;
  readAt: string;
  muted: boolean;
}

async function allChats(): Promise<Chat[]> {
  return (await allRows("Chats")) as unknown as Chat[];
}

function members(c: Chat): string[] {
  return c.memberIds.split(",").map((s) => s.trim()).filter(Boolean);
}

export function membersOf(c: Chat): string[] {
  return members(c);
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

export async function getMessage(id: string): Promise<Message | null> {
  return ((await allRows("Messages")) as unknown as Message[]).find((m) => m.id === id) ?? null;
}

// ---------- Group editing (creator or manager) ----------
export async function renameGroup(chatId: string, name: string): Promise<void> {
  await updateWhere("Chats", (r) => r.id === chatId && r.type === "group", { name: name.trim().slice(0, 80) });
}

export async function setGroupMembers(chatId: string, memberIds: string[], keepId: string): Promise<void> {
  const unique = Array.from(new Set([...memberIds, keepId].filter(Boolean)));
  await updateWhere("Chats", (r) => r.id === chatId && r.type === "group", { memberIds: unique.join(",") });
}

// ---------- Reactions ----------
export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  const rows = (await allRows("Reactions")) as unknown as Reaction[];
  const mine = rows.find((r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji);
  if (mine) {
    await deleteWhere("Reactions", (r) => r.id === mine.id);
  } else {
    await appendRow("Reactions", { id: genId("re"), messageId, userId, emoji, createdAt: new Date().toISOString() });
  }
}

export async function reactionsForMessageIds(ids: string[]): Promise<Reaction[]> {
  if (!ids.length) return [];
  const set = new Set(ids);
  return ((await allRows("Reactions")) as unknown as Reaction[]).filter((r) => set.has(r.messageId));
}

// ---------- Read state + mute (per user, in Settings) ----------
export async function markChatRead(userId: string, chatId: string): Promise<void> {
  await setSetting(`chatread:${userId}:${chatId}`, new Date().toISOString());
}

export async function isChatMuted(userId: string, chatId: string): Promise<boolean> {
  const raw = await getSetting(`chatmute:${userId}`);
  return raw.split(",").map((s) => s.trim()).includes(chatId);
}

export async function setChatMuted(userId: string, chatId: string, muted: boolean): Promise<void> {
  const raw = await getSetting(`chatmute:${userId}`);
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  if (muted) set.add(chatId);
  else set.delete(chatId);
  await setSetting(`chatmute:${userId}`, [...set].join(","));
}

/** Per-chat summary for the conversation list: last message, unread count, mute. */
export async function overviewFor(userId: string): Promise<Record<string, ChatOverview>> {
  const [chats, settings, msgs] = await Promise.all([
    listForUser(userId),
    getSettings(),
    allRows("Messages") as unknown as Promise<Message[]>,
  ]);
  const muteList = (settings[`chatmute:${userId}`] || "").split(",").map((s) => s.trim());
  const byChat: Record<string, Message[]> = {};
  for (const m of msgs) (byChat[m.chatId] ||= []).push(m);

  const out: Record<string, ChatOverview> = {};
  for (const c of chats) {
    const cm = (byChat[c.id] || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = cm[cm.length - 1];
    const readAt = settings[`chatread:${userId}:${c.id}`] || "";
    const unread = cm.filter((m) => m.fromUserId !== userId && m.createdAt > readAt).length;
    out[c.id] = {
      chatId: c.id,
      lastText: last?.content || "",
      lastAt: last?.createdAt || c.createdAt,
      lastFrom: last?.fromUserId || "",
      unread,
      readAt,
      muted: muteList.includes(c.id),
    };
  }
  return out;
}
