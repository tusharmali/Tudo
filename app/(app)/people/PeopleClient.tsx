"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTeammateAction,
  setUserSuspendedAction,
  setUserDepartmentAction,
  setUserRoleAction,
  setUserEmailAction,
  setTwofaEnabledAction,
} from "@/app/actions/team";
import { resetPasswordAction } from "@/app/actions/account";
import { roleLabel } from "@/lib/roles";
import { toast } from "@/components/Toaster";
import type { Role } from "@/lib/types";

type Person = { id: string; name: string; email: string; role: Role; department: string; status: string; color: string };
const BASE_DEPTS = ["Leadership", "Tech", "Digi", "Support", "HR"];

function initials(n: string) {
  return n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
const roleClass: Record<string, string> = { superadmin: "p-peri", hr: "p-sky", employee: "p-neut" };

export default function PeopleClient({
  me,
  users,
  departments,
  twofa,
  emailReady,
  ownerId,
}: {
  me: { id: string; role: Role };
  users: Person[];
  departments: string[];
  twofa: boolean;
  emailReady: boolean;
  ownerId: string;
}) {
  const router = useRouter();
  const iamSuper = me.role === "superadmin";
  const deptOptions = useMemo(() => [...new Set([...BASE_DEPTS, ...departments])], [departments]);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee" as Role, department: "" });
  const [editEmail, setEditEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.department.toLowerCase().includes(s);
  });
  const suspendedCount = users.filter((u) => u.status === "suspended").length;

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(key);
    const r = await fn();
    if (r.ok) { toast(r.message || "Done"); router.refresh(); }
    else toast(r.error || "Something went wrong");
    setBusy(null);
  }

  async function add() {
    if (!form.name.trim() || !form.email.trim() || !form.password) return toast("Name, email and password are required");
    await run("add", () => addTeammateAction(form));
    setForm({ name: "", email: "", password: "", role: "employee", department: "" });
  }

  function toggleSuspend(u: Person) {
    const suspend = u.status !== "suspended";
    if (suspend && !confirm(`Suspend ${u.name}? They won't be able to sign in until reactivated.`)) return;
    run(`sus:${u.id}`, () => setUserSuspendedAction({ userId: u.id, suspended: suspend }));
  }
  function changeDept(u: Person, department: string) {
    run(`dep:${u.id}`, () => setUserDepartmentAction({ userId: u.id, department }));
  }
  function changeRole(u: Person, role: Role) {
    run(`role:${u.id}`, () => setUserRoleAction({ userId: u.id, role }));
  }
  function startEmail(u: Person) {
    setEditEmail(u.id);
    setEmailDraft(u.email);
  }
  async function saveEmail(u: Person) {
    const email = emailDraft.trim().toLowerCase();
    if (!email || email === u.email) {
      setEditEmail(null);
      return;
    }
    await run(`email:${u.id}`, () => setUserEmailAction({ userId: u.id, email }));
    setEditEmail(null);
  }
  function resetPw(u: Person) {
    const next = prompt(`New password for ${u.name} (min 6 chars):`);
    if (next == null) return;
    if (next.length < 6) return toast("Password must be at least 6 characters");
    run(`pw:${u.id}`, () => resetPasswordAction({ userId: u.id, next }));
  }
  function toggle2fa() {
    if (!twofa && !emailReady) return toast("Set up Resend (RESEND_API_KEY) before turning on 2FA");
    if (!twofa && !confirm("Require an emailed code on new logins? Make sure every member has a real, reachable email first.")) return;
    run("2fa", () => setTwofaEnabledAction({ enabled: !twofa }));
  }

  return (
    <>
      <div className="grid g-4 stagger" style={{ marginBottom: 18 }}>
        <div className="stat tint-peri"><div className="k">Team size</div><div className="v num">{users.length}</div><div className="d muted">across {deptOptions.filter((d) => users.some((u) => u.department === d)).length} departments</div></div>
        <div className="stat tint-sky"><div className="k">Managers</div><div className="v num">{users.filter((u) => u.role !== "employee").length}</div><div className="d muted">admins + HR</div></div>
        <div className="stat tint-mint"><div className="k">Active</div><div className="v num">{users.length - suspendedCount}</div><div className="d muted">can sign in</div></div>
        <div className="stat tint-blush"><div className="k">Suspended</div><div className="v num">{suspendedCount}</div><div className="d muted">login blocked</div></div>
      </div>

      {iamSuper && (
        <div className="card pad" style={{ marginBottom: 18 }}>
          <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h3 className="sec" style={{ marginBottom: 4 }}>Email 2FA {twofa ? <span className="pill p-good" style={{ marginLeft: 6 }}>On</span> : <span className="pill p-neut" style={{ marginLeft: 6 }}>Off</span>}</h3>
              <p className="muted tiny" style={{ margin: 0 }}>
                When on, new logins need a code emailed to the member. Remembered devices skip it for 30 days.
                Needs a <b>verified Resend domain</b> + <code>EMAIL_FROM</code> set to it, so codes reach everyone (not just the owner).
                {!emailReady && " Resend isn't configured yet."}
              </p>
            </div>
            <button className={`btn ${twofa ? "btn-ghost" : "btn-primary"}`} onClick={toggle2fa} disabled={busy === "2fa"} style={{ whiteSpace: "nowrap" }}>
              {busy === "2fa" ? "…" : twofa ? "Turn off" : "Turn on"}
            </button>
          </div>
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 18 }}>
        <h3 className="sec" style={{ marginBottom: 12 }}>Add a teammate</h3>
        <div className="grid g-2" style={{ gap: 10 }}>
          <input className="inp" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="inp" placeholder="Email / login" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="inp" placeholder="Temp password (min 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="inp" placeholder="Department" list="dept-list" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
        <datalist id="dept-list">{deptOptions.map((d) => <option key={d} value={d} />)}</datalist>
        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <select className="inp" style={{ maxWidth: 200 }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="employee">Employee</option>
            {iamSuper && <option value="hr">HR Manager</option>}
            {iamSuper && <option value="superadmin">Super Admin</option>}
          </select>
          <button className="btn btn-primary" onClick={add} disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add teammate"}</button>
        </div>
      </div>

      <div className="card">
        <div className="between" style={{ padding: "16px 20px 10px", gap: 12, flexWrap: "wrap" }}>
          <h3 className="sec">Team members</h3>
          <input className="inp" placeholder="Search name, email, dept…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Member</th><th>Role</th><th>Department</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === me.id;
                const isOwner = u.id === ownerId;
                const locked = isOwner && !isSelf; // only the owner can edit the owner
                const canSuspend = !isSelf && !locked && (iamSuper || u.role !== "superadmin");
                return (
                  <tr key={u.id} style={{ opacity: u.status === "suspended" ? 0.6 : 1 }}>
                    <td>
                      <div className="row" style={{ gap: 10, minWidth: 0 }}>
                        <div className="avatar sm" style={{ background: u.color }}>{initials(u.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {u.name}{isSelf ? " (you)" : ""}
                            {isOwner && <span className="pill p-peri" style={{ marginLeft: 6, fontSize: 10, padding: "1px 7px" }}>Owner</span>}
                          </div>
                          {locked ? (
                            <div className="tiny faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }} title="Only the owner can change this account">
                              {u.email} 🔒
                            </div>
                          ) : editEmail === u.id ? (
                            <div className="row" style={{ gap: 4, marginTop: 2 }}>
                              <input
                                className="inp"
                                type="email"
                                value={emailDraft}
                                autoFocus
                                onChange={(e) => setEmailDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") saveEmail(u); if (e.key === "Escape") setEditEmail(null); }}
                                style={{ padding: "3px 7px", fontSize: 12, width: 190 }}
                              />
                              <button className="chip" onClick={() => saveEmail(u)} disabled={busy === `email:${u.id}`} style={{ padding: "3px 8px", fontSize: 11 }} title="Save">✓</button>
                              <button className="chip" onClick={() => setEditEmail(null)} style={{ padding: "3px 8px", fontSize: 11 }} title="Cancel">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEmail(u)}
                              title="Click to edit email"
                              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "var(--ink-faint)", fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                            >
                              {u.email} <span style={{ opacity: 0.7 }}>✎</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {iamSuper && !isSelf && !locked ? (
                        <select className="inp" style={{ padding: "5px 8px", fontSize: 12.5, width: 130 }} value={u.role} disabled={busy === `role:${u.id}`} onChange={(e) => changeRole(u, e.target.value as Role)}>
                          <option value="employee">Employee</option>
                          <option value="hr">HR Manager</option>
                          <option value="superadmin">Super Admin</option>
                        </select>
                      ) : (
                        <span className={`pill ${roleClass[u.role] || "p-neut"}`}>{roleLabel(u.role)}</span>
                      )}
                    </td>
                    <td>
                      <select className="inp" style={{ padding: "5px 8px", fontSize: 12.5, width: 130 }} value={u.department || ""} disabled={busy === `dep:${u.id}` || locked} onChange={(e) => changeDept(u, e.target.value)}>
                        <option value="">— none —</option>
                        {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${u.status === "suspended" ? "p-bad" : "p-good"}`}><span className="d" />{u.status === "suspended" ? "Suspended" : "Active"}</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {locked && <span className="tiny faint" title="Only the owner can change this account">🔒 Protected</span>}
                        {!locked && (
                          <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => resetPw(u)} disabled={busy === `pw:${u.id}`}>Reset password</button>
                        )}
                        {canSuspend && (
                          <button className={`btn ${u.status === "suspended" ? "btn-primary" : "btn-ghost"}`} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggleSuspend(u)} disabled={busy === `sus:${u.id}`}>
                            {u.status === "suspended" ? "Reactivate" : "Suspend"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
