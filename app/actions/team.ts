"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createUser } from "@/lib/users";
import { actionError, type Res } from "@/lib/action";
import type { Role } from "@/lib/types";

export async function addTeammateAction(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
}): Promise<Res> {
  try {
    await requireAdmin();
    if (!input.name?.trim() || !input.email?.trim() || !input.password) {
      return { ok: false, error: "Name, email and password are required." };
    }
    if (input.password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const user = await createUser({
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role === "superadmin" ? "superadmin" : "employee",
      department: input.department,
    });
    revalidatePath("/attendance");
    return { ok: true, message: `Added ${user.name}` };
  } catch (e) {
    return actionError(e);
  }
}
