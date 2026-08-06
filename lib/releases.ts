import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export interface Release {
  id: string;
  title: string;
  scheduledDate: string;
  points: string; // newline-separated
  resources: string; // newline-separated "Label|url"
  status: string; // scheduled | live | shipped
  createdAt: string;
}

export async function listReleases(): Promise<Release[]> {
  const rows = (await allRows("Releases")) as unknown as Release[];
  return rows.sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
}

export async function createRelease(input: {
  title: string;
  scheduledDate: string;
  points: string;
  resources: string;
  status: string;
}): Promise<void> {
  await appendRow("Releases", {
    id: genId("rel"),
    title: input.title,
    scheduledDate: input.scheduledDate,
    points: input.points,
    resources: input.resources,
    status: input.status || "scheduled",
    createdAt: new Date().toISOString(),
  });
}

export async function updateReleaseStatus(id: string, status: string): Promise<void> {
  await updateWhere("Releases", (r) => r.id === id, { status });
}

export async function deleteRelease(id: string): Promise<void> {
  await deleteWhere("Releases", (r) => r.id === id);
}
