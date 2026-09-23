"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  sendMessageAction,
  ensureDmAction,
  createGroupAction,
  renameGroupAction,
  updateGroupMembersAction,
  setChatMutedAction,
  reactMessageAction,
  markChatReadAction,
} from "@/app/actions/chat";
import { toast } from "@/components/Toaster";
import Avatar, { avatarSrc, initials } from "@/components/Avatar";

type ChatRow = { id: string; type: string; name: string; createdBy: string; memberIds: string; otherId: string };
type Msg = { id: string; chatId: string; fromUserId: string; content: string; createdAt: string };
type Reaction = { id: string; messageId: string; userId: string; emoji: string; createdAt: string };
type UserLite = { id: string; name: string };
type NameInfo = { name: string; color: string; avatar: string };
type Overview = { chatId: string; lastText: string; lastAt: string; lastFrom: string; unread: number; readAt: string; muted: boolean };

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "🙏", "🔥", "👏"];
const ALL_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "🎉", "👏", "🙏", "😂",
  "😅", "😊", "😍", "😎", "🤩", "😜", "🤔", "😐",
  "😴", "😢", "😭", "😡", "🤯", "🥳", "😱", "🤗",
  "🙌", "💪", "✅", "❌", "⭐", "💯", "👀", "💡",
  "🚀", "⏰", "📌", "☕", "🍕", "🎯", "✨", "💬",
  "📈", "🐛", "⚡", "🌟", "🤝", "👋", "🥲", "💀",
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}
const key = (m: { fromUserId: string; content: string }) => `${m.fromUserId} ${m.content}`;

export default function ChatClient({
  me,
  chats,
  users,
  allUsers,
  names,
  overview: overviewInit,
  isAdmin,
}: {
  me: UserLite;
  chats: ChatRow[];
  users: UserLite[];
  allUsers: UserLite[];
  names: Record<string, NameInfo>;
  overview: Record<string, Overview>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState(overviewInit);
  const [activeId, setActiveId] = useState("");
  const [server, setServer] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [separatorAt, setSeparatorAt] = useState("");
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [reactExpanded, setReactExpanded] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // group create
  const [groupOpen, setGroupOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gDept, setGDept] = useState("");
  const [gMembers, setGMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // group edit
  const [editOpen, setEditOpen] = useState(false);
  const [eName, setEName] = useState("");
  const [eMembers, setEMembers] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef(overview);
  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);

  const active = chats.find((c) => c.id === activeId) || null;

  // ---- open a conversation (captures the unread boundary, marks read) ----
  const openChat = useCallback(
    (id: string, push = true) => {
      if (!id) return;
      setSeparatorAt(overviewRef.current[id]?.readAt || "");
      setActiveId(id);
      setShowThread(true);
      setEditOpen(false);
      setReactFor(null);
      setEmojiOpen(false);
      setOverview((o) => ({ ...o, [id]: { ...o[id], unread: 0 } }));
      markChatReadAction({ chatId: id });
      if (push && typeof window !== "undefined") {
        window.history.pushState({ c: id }, "", `?c=${id}`);
      }
    },
    [],
  );

  // deep-link (?c=) on first load + browser back/forward
  useEffect(() => {
    const fromUrl = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("c") || "");
    const initial = fromUrl();
    if (initial && chats.some((c) => c.id === initial)) openChat(initial, false);
    const onPop = () => {
      const c = fromUrl();
      if (c && chats.some((x) => x.id === c)) openChat(c, false);
      else {
        setActiveId("");
        setShowThread(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link via Next navigation (e.g. clicking a chat notification while
  // already on /chat) — open the requested conversation.
  useEffect(() => {
    const c = searchParams.get("c");
    if (c && c !== activeId && chats.some((x) => x.id === c)) openChat(c, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Close the compose emoji picker on an outside click.
  useEffect(() => {
    if (!emojiOpen) return;
    function onDoc(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [emojiOpen]);

  // ---- polls ----
  const fetchMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/chat/messages?chatId=${encodeURIComponent(activeId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { messages: Msg[]; reactions: Reaction[] };
      const msgs = d.messages || [];
      setServer((prev) => (prev.length === msgs.length && prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id ? prev : msgs));
      setReactions(d.reactions || []);
      const have = new Set(msgs.map(key));
      setPending((prev) => prev.filter((p) => !have.has(key(p))));
    } catch {
      /* transient */
    }
  }, [activeId]);

  useEffect(() => {
    setServer([]);
    setPending([]);
    setReactions([]);
    if (!activeId) return;
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
  }, [activeId, fetchMessages]);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(fetchMessages, 4000);
    return () => clearInterval(t);
  }, [activeId, fetchMessages]);

  const refreshOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/overview", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { overview: Record<string, Overview> };
      setOverview((prev) => {
        // keep the active chat's unread at 0 (we're viewing it)
        const next = d.overview || {};
        if (activeId && next[activeId]) next[activeId] = { ...next[activeId], unread: 0 };
        return next;
      });
    } catch {
      /* transient */
    }
  }, [activeId]);

  useEffect(() => {
    const t = setInterval(refreshOverview, 7000);
    return () => clearInterval(t);
  }, [refreshOverview]);

  const messages = useMemo(() => {
    const have = new Set(server.map(key));
    const extra = pending.filter((p) => !have.has(key(p)));
    return [...server, ...extra];
  }, [server, pending]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const reactsByMsg = useMemo(() => {
    const m: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      (m[r.messageId] ||= {});
      const e = (m[r.messageId][r.emoji] ||= { count: 0, mine: false });
      e.count++;
      if (r.userId === me.id) e.mine = true;
    }
    return m;
  }, [reactions, me.id]);

  const firstUnreadIdx = useMemo(() => {
    if (!separatorAt) return -1;
    return messages.findIndex((m) => m.fromUserId !== me.id && m.createdAt > separatorAt);
  }, [messages, separatorAt, me.id]);

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => (overview[b.id]?.lastAt || "").localeCompare(overview[a.id]?.lastAt || ""));
  }, [chats, overview]);

  // ---- actions ----
  async function send() {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setInput("");
    setEmojiOpen(false);
    setSending(true);
    const optimistic: Msg = { id: `tmp_${Date.now()}`, chatId: activeId, fromUserId: me.id, content: text, createdAt: new Date().toISOString() };
    setPending((prev) => [...prev, optimistic]);
    const r = await sendMessageAction({ chatId: activeId, content: text });
    if (r.ok) fetchMessages();
    else {
      toast(r.error || "Couldn't send");
      setPending((prev) => prev.filter((p) => p.id !== optimistic.id));
    }
    setSending(false);
  }

  async function startDm(otherId: string) {
    if (!otherId) return;
    const r = await ensureDmAction({ otherId });
    if (r.ok && r.data) {
      router.refresh();
      openChat(r.data);
    } else toast(r.error || "Error");
  }

  async function createGroup() {
    if (!gName.trim() || gMembers.length === 0) {
      toast("Name the group and pick members");
      return;
    }
    setCreating(true);
    const r = await createGroupAction({ name: gName, department: gDept, memberIds: gMembers });
    if (r.ok && r.data) {
      toast(r.message || "Created");
      setGroupOpen(false);
      setGName("");
      setGDept("");
      setGMembers([]);
      router.refresh();
      openChat(r.data);
    } else toast(r.error || "Error");
    setCreating(false);
  }

  function beginEdit() {
    if (!active) return;
    setEName(active.name);
    setEMembers(active.memberIds.split(",").map((s) => s.trim()).filter(Boolean));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!active) return;
    if (!eName.trim() || eMembers.length === 0) {
      toast("Need a name and at least one member");
      return;
    }
    setSavingEdit(true);
    let ok = true;
    if (eName.trim() !== active.name) {
      const r = await renameGroupAction({ chatId: active.id, name: eName });
      if (!r.ok) {
        ok = false;
        toast(r.error || "Error");
      }
    }
    const current = active.memberIds.split(",").map((s) => s.trim()).filter(Boolean).sort().join(",");
    if (ok && eMembers.slice().sort().join(",") !== current) {
      const r = await updateGroupMembersAction({ chatId: active.id, memberIds: eMembers });
      if (!r.ok) {
        ok = false;
        toast(r.error || "Error");
      }
    }
    if (ok) {
      toast("Group updated");
      setEditOpen(false);
      router.refresh();
    }
    setSavingEdit(false);
  }

  async function toggleMute() {
    if (!active || muteBusy) return;
    const muted = !overview[active.id]?.muted;
    setMuteBusy(true);
    setOverview((o) => ({ ...o, [active.id]: { ...o[active.id], muted } }));
    const r = await setChatMutedAction({ chatId: active.id, muted });
    if (!r.ok) {
      setOverview((o) => ({ ...o, [active.id]: { ...o[active.id], muted: !muted } }));
      toast(r.error || "Error");
    } else toast(r.message || "");
    setMuteBusy(false);
  }

  async function react(messageId: string, emoji: string) {
    setReactFor(null);
    setReactions((prev) => {
      const mine = prev.find((r) => r.messageId === messageId && r.userId === me.id && r.emoji === emoji);
      if (mine) return prev.filter((r) => r !== mine);
      return [...prev, { id: `tmp_${Date.now()}`, messageId, userId: me.id, emoji, createdAt: new Date().toISOString() }];
    });
    const r = await reactMessageAction({ messageId, emoji });
    if (!r.ok) toast(r.error || "Error");
    fetchMessages();
  }

  function chatAvatar(c: ChatRow, size?: "sm" | "lg") {
    if (c.type === "group") return <Avatar name={c.name} color="var(--lilac)" size={size} />;
    const info = names[c.otherId];
    return <Avatar name={c.name} color={info?.color} src={avatarSrc({ id: c.otherId, avatar: info?.avatar })} size={size} />;
  }

  const canEdit = !!active && active.type === "group" && (isAdmin || active.createdBy === me.id);
  const muted = !!(active && overview[active.id]?.muted);

  return (
    <>
      <div className="between" style={{ marginBottom: 14 }}>
        <h3 className="sec">Messages</h3>
        <div className="row" style={{ gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setGroupOpen((v) => !v)}>
              + New group
            </button>
          )}
          <button className="icon-btn" onClick={() => { fetchMessages(); refreshOverview(); }} title="Refresh">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6 5.3L4 8M4 15a8 8 0 0 0 14 3.7l2-2.7" />
            </svg>
          </button>
        </div>
      </div>

      {groupOpen && isAdmin && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 className="sec" style={{ marginBottom: 12 }}>Create a group</h3>
          <div className="grid g-2" style={{ gap: 10, marginBottom: 10 }}>
            <input className="inp" placeholder="Group name (e.g. Dev Team)" value={gName} onChange={(e) => setGName(e.target.value)} />
            <input className="inp" placeholder="Department (optional)" value={gDept} onChange={(e) => setGDept(e.target.value)} />
          </div>
          <label className="lbl">Members</label>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {allUsers.filter((u) => u.id !== me.id).map((u) => {
              const on = gMembers.includes(u.id);
              return (
                <button key={u.id} type="button" className={`chip${on ? " chip-on" : ""}`} onClick={() => setGMembers((m) => (on ? m.filter((x) => x !== u.id) : [...m, u.id]))}>
                  {on ? "✓ " : ""}{u.name}
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" onClick={createGroup} disabled={creating}>
            {creating ? "Creating…" : "Create group"}
          </button>
        </div>
      )}

      <div className={`chat-wrap${showThread ? " show-thread" : ""}`}>
        <div className="chat-list">
          <div style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
            <select className="inp" value="" onChange={(e) => startDm(e.target.value)}>
              <option value="">+ New direct message…</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          {sortedChats.length === 0 && <p className="tiny faint" style={{ padding: 14 }}>No conversations yet.</p>}
          {sortedChats.map((c) => {
            const ov = overview[c.id];
            const preview = ov?.lastText ? `${ov.lastFrom === me.id ? "You: " : ""}${ov.lastText}` : c.type === "group" ? "Group chat" : "Direct message";
            const unread = activeId === c.id ? 0 : ov?.unread || 0;
            return (
              <button key={c.id} className={`chat-li${activeId === c.id ? " on" : ""}`} onClick={() => openChat(c.id)} type="button">
                {chatAvatar(c)}
                <div className="cinfo">
                  <div className="cn">
                    <span className="ellip">{c.name}</span>
                    <span className="tm">{fmtWhen(ov?.lastAt || "")}</span>
                  </div>
                  <div className="cn-row">
                    <div className={`cm${unread ? " unread" : ""}`}>{preview}</div>
                    <div className="cn-meta">
                      {ov?.muted && <span className="mute-ic" title="Muted">🔕</span>}
                      {unread > 0 && <span className="chat-badge">{unread > 99 ? "99+" : unread}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="chat-main">
          {active ? (
            <>
              <div className="chat-head">
                <button className="icon-btn only-mobile" style={{ width: 32, height: 32 }} onClick={() => setShowThread(false)} title="Back" type="button">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /></svg>
                </button>
                {chatAvatar(active, "sm")}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellip" style={{ fontWeight: 650, fontSize: 14 }}>{active.name}</div>
                  <div className="tiny faint">
                    {active.type === "group" ? `${active.memberIds.split(",").filter(Boolean).length} members` : "Direct message"}
                  </div>
                </div>
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={toggleMute} disabled={muteBusy} title={muted ? "Unmute" : "Mute"}>
                  <span style={{ fontSize: 15 }}>{muted ? "🔕" : "🔔"}</span>
                </button>
                {canEdit && (
                  <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={beginEdit} title="Edit group">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></svg>
                  </button>
                )}
              </div>

              {editOpen && canEdit && (
                <div className="card pad" style={{ margin: 12, marginBottom: 0 }}>
                  <div className="between" style={{ marginBottom: 10 }}>
                    <h3 className="sec" style={{ margin: 0 }}>Edit group</h3>
                    <button className="chip" type="button" onClick={() => setEditOpen(false)}>Close</button>
                  </div>
                  <label className="lbl">Name</label>
                  <input className="inp" value={eName} onChange={(e) => setEName(e.target.value)} style={{ marginBottom: 12 }} />
                  <label className="lbl">Members</label>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {allUsers.map((u) => {
                      const on = eMembers.includes(u.id);
                      const isCreator = u.id === active.createdBy;
                      return (
                        <button key={u.id} type="button" className={`chip${on ? " chip-on" : ""}`} disabled={isCreator}
                          onClick={() => setEMembers((m) => (on ? m.filter((x) => x !== u.id) : [...m, u.id]))}
                          title={isCreator ? "Group creator" : ""}>
                          {on ? "✓ " : ""}{u.name}{isCreator ? " ·owner" : ""}
                        </button>
                      );
                    })}
                  </div>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? "Saving…" : "Save changes"}
                  </button>
                </div>
              )}

              <div className="chat-body" ref={bodyRef}>
                {messages.length === 0 && (
                  <p className="tiny faint" style={{ margin: "auto" }}>{loading ? "Loading messages…" : "No messages yet — say hi 👋"}</p>
                )}
                {messages.map((m, i) => {
                  const mine = m.fromUserId === me.id;
                  const rx = reactsByMsg[m.id];
                  return (
                    <div key={m.id} className={`msgwrap ${mine ? "me" : "them"}`}>
                      {i === firstUnreadIdx && firstUnreadIdx > 0 && (
                        <div className="unread-sep"><span>Unread messages</span></div>
                      )}
                      <div className={`bubble-row ${mine ? "me" : "them"}`}>
                        <div className={`bubble ${mine ? "me" : "them"}`}>
                          {!mine && active.type === "group" && <div className="who">{names[m.fromUserId]?.name || "Unknown"}</div>}
                          <span className="btext">{m.content}</span>
                          <span className="bt">{fmtTime(m.createdAt)}</span>
                        </div>
                        {!m.id.startsWith("tmp_") && (
                          <div className="react-wrap">
                            <button className="react-add" type="button" onClick={() => { setReactFor(reactFor === m.id ? null : m.id); setReactExpanded(false); }} title="React">😊</button>
                            {reactFor === m.id && (
                              <div className={`react-pop${reactExpanded ? " expanded" : ""}`}>
                                {(reactExpanded ? ALL_EMOJIS : QUICK_EMOJIS).map((e) => (
                                  <button key={e} type="button" onClick={() => react(m.id, e)}>{e}</button>
                                ))}
                                {!reactExpanded && (
                                  <button type="button" className="more" title="More emojis" onClick={(ev) => { ev.stopPropagation(); setReactExpanded(true); }}>＋</button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {rx && (
                        <div className={`reacts ${mine ? "me" : "them"}`}>
                          {Object.entries(rx).map(([emoji, { count, mine: didI }]) => (
                            <button key={emoji} type="button" className={`react-chip${didI ? " mine" : ""}`} onClick={() => react(m.id, emoji)}>
                              {emoji} {count}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="chat-input">
                <div className="emoji-wrap" ref={emojiRef}>
                  <button type="button" className="emoji-btn" onClick={() => setEmojiOpen((v) => !v)} title="Emoji">😊</button>
                  {emojiOpen && (
                    <div className="emoji-pop">
                      {ALL_EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => setInput((s) => s + e)}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input placeholder="Message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
                <button className="send" onClick={send} type="button" disabled={sending} title="Send">
                  {sending ? (
                    <span className="spin-dot" />
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m22 2-7 20-4-9-9-4 20-7Z" /></svg>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="empty" style={{ margin: "auto" }}>
              <div className="t">Pick a conversation</div>
              <div className="s">or start a new one from the left</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
