import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";
import { getSetting, setSetting, getSettings } from "./settings";

export interface Chat {
  id: string;
  type: string; // dm | group
  name: string;
  department: string;
  memberIds: string; // comma-separated current members
  formerMembers: string; // comma-separated "userId:leftAtISO" — read-only history access
  createdBy: string;
  createdAt: string;
}

/** Parse "id:iso,id:iso" → { id: leftAtISO }. */
function parseFormer(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (s || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}
function serializeFormer(m: Record<string, string>): string {
  return Object.entries(m).map(([id, at]) => `${id}:${at}`).join(",");
}

export interface ChatAccess {
  member: boolean; // current member — can read + write
  former: boolean; // left/removed — read-only up to `cutoff`
  cutoff: string; // ISO; only messages <= cutoff are visible to a former member
}

export function chatAccess(c: Chat, userId: string): ChatAccess {
  if (members(c).includes(userId)) return { member: true, former: false, cutoff: "" };
  const former = parseFormer(c.formerMembers);
  if (former[userId] !== undefined) return { member: false, former: true, cutoff: former[userId] };
  return { member: false, former: false, cutoff: "" };
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
  readOnly: boolean; // true if the viewer only has former-member (history) access
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
  return (await allChats()).filter((c) => members(c).includes(userId) || parseFormer(c.formerMembers)[userId] !== undefined);
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
    formerMembers: "",
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
    formerMembers: "",
    createdBy: a,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getMessages(chatId: string, opts?: { until?: string }): Promise<Message[]> {
  const rows = (await allRows("Messages")) as unknown as Message[];
  return rows
    .filter((m) => m.chatId === chatId && (!opts?.until || m.createdAt <= opts.until))
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
  const chat = await getChat(chatId);
  if (!chat || chat.type !== "group") return;
  const before = members(chat);
  const after = Array.from(new Set([...memberIds, keepId].filter(Boolean)));
  const removed = before.filter((id) => !after.includes(id));

  const former = parseFormer(chat.formerMembers);
  const now = new Date().toISOString();
  for (const id of removed) former[id] = now; // left → read-only from now
  for (const id of after) delete former[id]; // re-added → full member again

  await updateWhere("Chats", (r) => r.id === chatId && r.type === "group", {
    memberIds: after.join(","),
    formerMembers: serializeFormer(former),
  });
}

/** A member leaves a group themselves (the creator can't leave). */
export async function leaveGroup(chatId: string, userId: string): Promise<boolean> {
  const chat = await getChat(chatId);
  if (!chat || chat.type !== "group") return false;
  if (chat.createdBy === userId) return false; // owner stays
  if (!members(chat).includes(userId)) return false;
  const after = members(chat).filter((id) => id !== userId);
  const former = parseFormer(chat.formerMembers);
  former[userId] = new Date().toISOString();
  await updateWhere("Chats", (r) => r.id === chatId && r.type === "group", {
    memberIds: after.join(","),
    formerMembers: serializeFormer(former),
  });
  return true;
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

// ---------- Chat background theme (per user) ----------
export const CHAT_THEMES = ["default", "plain", "mint", "blush", "sky", "sand", "graphite"];

export async function getChatTheme(userId: string): Promise<string> {
  const t = await getSetting(`chattheme:${userId}`);
  return CHAT_THEMES.includes(t) ? t : "default";
}
export async function setChatTheme(userId: string, theme: string): Promise<void> {
  await setSetting(`chattheme:${userId}`, CHAT_THEMES.includes(theme) ? theme : "default");
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
    const access = chatAccess(c, userId);
    let cm = (byChat[c.id] || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (access.former) cm = cm.filter((m) => m.createdAt <= access.cutoff); // only what they can see
    const last = cm[cm.length - 1];
    const readAt = settings[`chatread:${userId}:${c.id}`] || "";
    const unread = access.former ? 0 : cm.filter((m) => m.fromUserId !== userId && m.createdAt > readAt).length;
    out[c.id] = {
      chatId: c.id,
      lastText: last?.content || "",
      lastAt: last?.createdAt || c.createdAt,
      lastFrom: last?.fromUserId || "",
      unread,
      readAt,
      muted: muteList.includes(c.id),
      readOnly: access.former,
    };
  }
  return out;
}
