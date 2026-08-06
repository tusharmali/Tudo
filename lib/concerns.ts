import { allRows, appendRow, updateWhere, genId } from "./db";

export interface Concern {
  id: string;
  fromUserId: string;
  toUserId: string;
  subject: string;
  message: string;
  status: string; // open | resolved
  createdAt: string;
}

export interface Reply {
  id: string;
  concernId: string;
  userId: string;
  message: string;
  createdAt: string;
}

async function all(): Promise<Concern[]> {
  return (await allRows("Concerns")) as unknown as Concern[];
}

/** Concerns the user sent or received. */
export async function listRelated(userId: string): Promise<Concern[]> {
  return (await all()).filter((c) => c.fromUserId === userId || c.toUserId === userId).reverse();
}

export async function createConcern(fromUserId: string, toUserId: string, subject: string, message: string): Promise<string> {
  const id = genId("cn");
  await appendRow("Concerns", {
    id,
    fromUserId,
    toUserId,
    subject,
    message,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function setStatus(id: string, status: string): Promise<void> {
  await updateWhere("Concerns", (r) => r.id === id, { status });
}

export async function allReplies(): Promise<Reply[]> {
  return (await allRows("ConcernReplies")) as unknown as Reply[];
}

export async function addReply(concernId: string, userId: string, message: string): Promise<void> {
  await appendRow("ConcernReplies", {
    id: genId("rp"),
    concernId,
    userId,
    message,
    createdAt: new Date().toISOString(),
  });
}
