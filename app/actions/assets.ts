"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/dal";
import { addAsset, updateAsset, removeAsset, type Asset } from "@/lib/assets";
import { logAction } from "@/lib/audit";
import { actionError, type Res } from "@/lib/action";

export async function addAssetAction(input: Partial<Asset>): Promise<Res> {
  try {
    const me = await requireManager();
    if (!input.name?.trim()) return { ok: false, error: "Give the asset a name." };
    await addAsset({ ...input, createdBy: me.sub });
    await logAction(me, "Assets", "Added an asset", `${input.name} · ${input.type || "Other"}`);
    revalidatePath("/assets");
    return { ok: true, message: "Asset added" };
  } catch (e) {
    return actionError(e);
  }
}

export async function updateAssetAction(input: { id: string; patch: Partial<Asset> }): Promise<Res> {
  try {
    const me = await requireManager();
    await updateAsset(input.id, input.patch);
    await logAction(me, "Assets", "Updated an asset", Object.keys(input.patch).join(", "));
    revalidatePath("/assets");
    return { ok: true, message: "Saved" };
  } catch (e) {
    return actionError(e);
  }
}

export async function deleteAssetAction(input: { id: string }): Promise<Res> {
  try {
    const me = await requireManager();
    await removeAsset(input.id);
    await logAction(me, "Assets", "Removed an asset", input.id);
    revalidatePath("/assets");
    return { ok: true, message: "Removed" };
  } catch (e) {
    return actionError(e);
  }
}
