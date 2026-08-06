"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction, ensureDmAction, createGroupAction } from "@/app/actions/chat";
import { toast } from "@/components/Toaster";

type ChatRow = { id: string; type: string; name: string };
type Msg = { id: string; chatId: string; fromUserId: string; content: string; createdAt: string };
type UserLite = { id: string; name: string };

function initials(n: string): string {
  return (n || "?").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatClient({
  me,
  chats,
  users,
  names,
  isAdmin,
}: {
  me: UserLite;
  chats: ChatRow[];
  users: UserLite[];
  names: Record<string, { name: string; color: string }>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(chats[0]?.id || "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [showThread, setShowThread] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gDept, setGDept] = useState("");
  const [gMembers, setGMembers] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      const res = await fetch(`/api/chat/messages?chatId=${encodeURIComponent(activeId)}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { messages: Msg[] };
        setMessages(d.messages || []);
      }
    } catch {
      /* ignore transient */
    }
  }, [activeId]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [activeId, fetchMessages]);

  useEffect(() => {
    const t = setInterval(fetchMessages, 4000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const active = chats.find((c) => c.id === activeId) || null;

  async function send() {
    const text = input.trim();
    if (!text || !activeId) return;
    setInput("");
    const optimistic: Msg = { id: `tmp_${Date.now()}`, chatId: activeId, fromUserId: me.id, content: text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    const r = await sendMessageAction({ chatId: activeId, content: text });
    if (r.ok) fetchMessages();
    else toast(r.error || "Couldn't send");
  }

  async function startDm(otherId: string) {
    if (!otherId) return;
    const r = await ensureDmAction({ otherId });
    if (r.ok && r.data) {
      setActiveId(r.data);
      setShowThread(true);
      router.refresh();
    } else toast(r.error || "Error");
  }

  async function createGroup() {
    if (!gName.trim() || gMembers.length === 0) {
      toast("Name the group and pick members");
      return;
    }
    const r = await createGroupAction({ name: gName, department: gDept, memberIds: gMembers });
    if (r.ok && r.data) {
      toast(r.message || "Created");
      setGroupOpen(false);
      setGName("");
      setGDept("");
      setGMembers([]);
      setActiveId(r.data);
      router.refresh();
    } else toast(r.error || "Error");
  }

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
          <button className="icon-btn" onClick={fetchMessages} title="Refresh">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6 5.3L4 8M4 15a8 8 0 0 0 14 3.7l2-2.7" />
            </svg>
          </button>
        </div>
      </div>

      {groupOpen && isAdmin && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 className="sec" style={{ marginBottom: 12 }}>
            Create a department group
          </h3>
          <div className="grid g-2" style={{ gap: 10, marginBottom: 10 }}>
            <input className="inp" placeholder="Group name (e.g. Dev Team)" value={gName} onChange={(e) => setGName(e.target.value)} />
            <input className="inp" placeholder="Department (optional)" value={gDept} onChange={(e) => setGDept(e.target.value)} />
          </div>
          <label className="lbl">Members</label>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {users
              .filter((u) => u.id !== me.id)
              .map((u) => {
                const on = gMembers.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`chip${on ? "" : ""}`}
                    style={on ? { borderColor: "var(--accent)", color: "var(--accent-ink)", background: "var(--accent-wash)" } : undefined}
                    onClick={() => setGMembers((m) => (on ? m.filter((x) => x !== u.id) : [...m, u.id]))}
                  >
                    {on ? "✓ " : ""}
                    {u.name}
                  </button>
                );
              })}
          </div>
          <button className="btn btn-primary" onClick={createGroup}>
            Create group
          </button>
        </div>
      )}

      <div className={`chat-wrap${showThread ? " show-thread" : ""}`}>
        <div className="chat-list">
          <div style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
            <select
              className="inp"
              value=""
              onChange={(e) => {
                startDm(e.target.value);
              }}
            >
              <option value="">+ New direct message…</option>
              {users
                .filter((u) => u.id !== me.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          {chats.length === 0 && <p className="tiny faint" style={{ padding: 14 }}>No conversations yet.</p>}
          {chats.map((c) => (
            <button
              key={c.id}
              className={`chat-li${activeId === c.id ? " on" : ""}`}
              onClick={() => {
                setActiveId(c.id);
                setShowThread(true);
              }}
              type="button"
            >
              <div className="avatar sm" style={{ background: c.type === "group" ? "var(--lilac)" : "var(--accent)" }}>
                {initials(c.name)}
              </div>
              <div className="cinfo">
                <div className="cn">
                  <span>{c.name}</span>
                </div>
                <div className="cm">{c.type === "group" ? "Group chat" : "Direct message"}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="chat-main">
          {active ? (
            <>
              <div className="chat-head">
                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setShowThread(false)} title="Back" type="button">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className="avatar sm" style={{ background: active.type === "group" ? "var(--lilac)" : "var(--accent)" }}>
                  {initials(active.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{active.name}</div>
                  <div className="tiny faint">{active.type === "group" ? "Group chat" : "Direct message"}</div>
                </div>
              </div>
              <div className="chat-body" ref={bodyRef}>
                {messages.length === 0 && (
                  <p className="tiny faint" style={{ margin: "auto" }}>
                    No messages yet — say hi 👋
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.fromUserId === me.id;
                  return (
                    <div key={m.id} className={`bubble ${mine ? "me" : "them"}`}>
                      {!mine && active.type === "group" && <div className="who">{names[m.fromUserId]?.name || "Unknown"}</div>}
                      {m.content}
                      <div className="bt">{fmtTime(m.createdAt)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="chat-input">
                <input
                  placeholder="Message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                />
                <button className="send" onClick={send} type="button">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m22 2-7 20-4-9-9-4 20-7Z" />
                  </svg>
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
