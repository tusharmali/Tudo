import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export const ASSET_TYPES = ["Laptop", "Charger", "Monitor", "Phone", "Keyboard", "Mouse", "Headset", "Other"];
export const ASSET_STATUSES = ["in-use", "spare", "in-repair", "retired"];

export interface Asset {
  id: string;
  name: string;
  type: string;
  serial: string;
  provider: string;
  assignedTo: string;
  status: string;
  cost: string; // optional reference price
  purchaseDate: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

async function all(): Promise<Asset[]> {
  return (await allRows("Assets")) as unknown as Asset[];
}

export async function listAssets(): Promise<Asset[]> {
  return (await all()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function addAsset(input: Partial<Asset> & { createdBy: string }): Promise<string> {
  const id = genId("as");
  await appendRow("Assets", {
    id,
    name: (input.name || "").trim().slice(0, 120),
    type: input.type || "Other",
    serial: (input.serial || "").trim().slice(0, 80),
    provider: (input.provider || "").trim().slice(0, 120),
    assignedTo: input.assignedTo || "",
    status: ASSET_STATUSES.includes(input.status || "") ? input.status! : "in-use",
    cost: input.cost ? String(Number(input.cost) || "") : "",
    purchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate || "") ? input.purchaseDate! : "",
    notes: (input.notes || "").trim().slice(0, 500),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<number> {
  const allowed: (keyof Asset)[] = ["name", "type", "serial", "provider", "assignedTo", "status", "cost", "purchaseDate", "notes"];
  const clean: Record<string, string> = {};
  for (const k of allowed) if (patch[k] !== undefined) clean[k] = String(patch[k]);
  if (!Object.keys(clean).length) return 0;
  return updateWhere("Assets", (r) => r.id === id, clean);
}

export async function removeAsset(id: string): Promise<number> {
  return deleteWhere("Assets", (r) => r.id === id);
}
