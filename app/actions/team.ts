"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireAdmin } from "@/lib/dal";
import { createUser, getUserById, setUserStatus, setUserRole, setUserDepartment, setUserEmail } from "@/lib/users";
import { setTwofaEnabled } from "@/lib/twofa";
import { assertCanModify } from "@/lib/owner";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["employee", "hr", "director", "superadmin"];

export async function addTeammateAction(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
}): Promise<Res> {
  try {
    const me = await requireManager();
    if (!input.name?.trim() || !input.email?.trim() || !input.password) {
      return { ok: false, error: "Name, email and password are required." };
    }
    if (input.password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    let role: Role = ROLES.includes(input.role) ? input.role : "employee";
    // Only a super-admin can mint a privileged role (admin / director / hr).
    if (role !== "employee" && me.role !== "superadmin") role = "employee";
    const user = await createUser({
      name: input.name,
      email: input.email,
      password: input.password,
      role,
      department: input.department,
    });
    await logAction(me, "People", "Added teammate", `${user.name} · ${role}${input.department ? " · " + input.department : ""}`);
    revalidatePath("/people");
    revalidatePath("/attendance");
    return { ok: true, message: `Added ${user.name}` };
  } catch (e) {
    return actionError(e);
  }
}

export async function setUserSuspendedAction(input: { userId: string; suspended: boolean }): Promise<Res> {
  try {
    const me = await requireManager();
    if (input.userId === me.sub) return { ok: false, error: "You can't suspend your own account." };
    await assertCanModify(input.userId, me.sub);
    const target = await getUserById(input.userId);
    if (!target) return { ok: false, error: "User not found." };
    // Only a super-admin may suspend another super-admin (protects the owners).
    if (target.role === "superadmin" && me.role !== "superadmin") {
      return { ok: false, error: "Only a super-admin can suspend another super-admin." };
    }
    await setUserStatus(input.userId, input.suspended ? "suspended" : "active");
    await logAction(me, "People", input.suspended ? "Suspended user" : "Reactivated user", target.name);
    revalidatePath("/people");
    return { ok: true, message: input.suspended ? `${target.name} suspended` : `${target.name} reactivated` };
  } catch (e) {
    return actionError(e);
  }
}

export async function setUserDepartmentAction(input: { userId: string; department: string }): Promise<Res> {
  try {
    const me = await requireManager();
    await assertCanModify(input.userId, me.sub);
    await setUserDepartment(input.userId, input.department);
    await logAction(me, "People", "Changed department", `${(await getUserById(input.userId))?.name || input.userId} → ${input.department || "none"}`);
    revalidatePath("/people");
    return { ok: true, message: "Department updated" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setUserEmailAction(input: { userId: string; email: string }): Promise<Res> {
  try {
    const me = await requireManager();
    await assertCanModify(input.userId, me.sub);
    const beforeEmail = (await getUserById(input.userId))?.name || input.userId;
    await setUserEmail(input.userId, input.email);
    await logAction(me, "People", "Changed login email", `${beforeEmail} → ${input.email}`);
    revalidatePath("/people");
    return { ok: true, message: "Email updated" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setTwofaEnabledAction(input: { enabled: boolean }): Promise<Res> {
  try {
    const me = await requireAdmin(); // security policy — super-admin only
    if (input.enabled) {
      // Guard against locking everyone out: refuse while email can't reach non-owners.
      if (!process.env.RESEND_API_KEY) {
        return { ok: false, error: "Set up Resend (RESEND_API_KEY) before enabling 2FA." };
      }
      const from = process.env.EMAIL_FROM || "";
      if (!from || /onboarding@resend\.dev/i.test(from)) {
        return {
          ok: false,
          error: "Verify a domain in Resend and set EMAIL_FROM to an address on it first — the default sender only reaches your own inbox, so everyone else would be locked out.",
        };
      }
    }
    await setTwofaEnabled(input.enabled);
    await logAction(me, "Security", input.enabled ? "Enabled email 2FA" : "Disabled email 2FA", "");
    revalidatePath("/people");
    return { ok: true, message: input.enabled ? "Email 2FA is now required on new logins" : "Email 2FA turned off" };
  } catch (e) {
    return actionError(e);
  }
}

export async function setUserRoleAction(input: { userId: string; role: Role }): Promise<Res> {
  try {
    const me = await requireAdmin(); // role changes are super-admin only
    if (!ROLES.includes(input.role)) return { ok: false, error: "Unknown role." };
    if (input.userId === me.sub) return { ok: false, error: "You can't change your own role." };
    await assertCanModify(input.userId, me.sub);
    const roleTarget = (await getUserById(input.userId))?.name || input.userId;
    await setUserRole(input.userId, input.role);
    await logAction(me, "People", "Changed role", `${roleTarget} → ${input.role}`);
    revalidatePath("/people");
    return { ok: true, message: "Role updated" };
  } catch (e) {
    return actionError(e);
  }
}
