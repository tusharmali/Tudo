/** Broadcast polls — a manager asks a question (e.g. "who's coming to the
 *  office event?"), targeted at everyone or a department, with a close time.
 *  Members respond; managers see who's in / who's not. */
import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";
import type { User } from "./types";

export interface Poll {
  id: string;
  question: string;
  options: string[];
  target: string; // "all" or a department name
  createdBy: string;
  closesAt: string; // ISO; "" = never closes
  createdAt: string;
}

export interface PollVote {
  id: string;
  pollId: string;
  userId: string;
  option: string;
  createdAt: string;
}

type RawPoll = Omit<Poll, "options"> & { options: string };

function parse(r: RawPoll): Poll {
  let options: string[] = [];
  try {
    const o = JSON.parse(r.options || "[]");
    if (Array.isArray(o)) options = o.map(String);
  } catch {
    options = (r.options || "").split("\n").map((s) => s.trim()).filter(Boolean);
  }
  return { ...r, options };
}

export function pollIsOpen(p: Poll): boolean {
  return !p.closesAt || Date.now() < new Date(p.closesAt).getTime();
}

export function canSeePoll(p: Poll, user: { department?: string; dept?: string }): boolean {
  if (p.target === "all") return true;
  return p.target === (user.department ?? user.dept ?? "");
}

async function allPolls(): Promise<Poll[]> {
  return ((await allRows("Polls")) as unknown as RawPoll[]).map(parse).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function listPolls(): Promise<Poll[]> {
  return allPolls();
}
export async function getPoll(id: string): Promise<Poll | null> {
  return (await allPolls()).find((p) => p.id === id) ?? null;
}

export async function createPoll(input: { question: string; options: string[]; target: string; closesAt: string; createdBy: string }): Promise<string> {
  const id = genId("poll");
  const opts = input.options.map((o) => o.trim()).filter(Boolean).slice(0, 10);
  await appendRow("Polls", {
    id,
    question: input.question.trim().slice(0, 300),
    options: JSON.stringify(opts.length ? opts : ["I'm in", "Not able to"]),
    target: input.target || "all",
    createdBy: input.createdBy,
    closesAt: input.closesAt || "",
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function closePoll(id: string): Promise<void> {
  await updateWhere("Polls", (r) => r.id === id, { closesAt: new Date().toISOString() });
}
export async function removePoll(id: string): Promise<void> {
  await deleteWhere("Polls", (r) => r.id === id);
  await deleteWhere("PollVotes", (r) => r.pollId === id);
}

export async function vote(pollId: string, userId: string, option: string): Promise<void> {
  const existing = (await allRows("PollVotes")).find((v) => v.pollId === pollId && v.userId === userId);
  if (existing) {
    await updateWhere("PollVotes", (r) => r.pollId === pollId && r.userId === userId, { option, createdAt: new Date().toISOString() });
  } else {
    await appendRow("PollVotes", { id: genId("pv"), pollId, userId, option, createdAt: new Date().toISOString() });
  }
}

export async function votesForPoll(pollId: string): Promise<PollVote[]> {
  return ((await allRows("PollVotes")) as unknown as PollVote[]).filter((v) => v.pollId === pollId);
}

/** All poll votes (for building result maps across many polls in one read). */
export async function allVotes(): Promise<PollVote[]> {
  return (await allRows("PollVotes")) as unknown as PollVote[];
}

export interface PollResult {
  counts: Record<string, number>;
  byUser: Record<string, string>; // userId -> option
  responded: string[];
  notResponded: string[];
}

/** Tally a poll against the users it targets. */
export function tally(poll: Poll, votes: PollVote[], audience: User[]): PollResult {
  const relevant = votes.filter((v) => v.pollId === poll.id);
  const byUser: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const o of poll.options) counts[o] = 0;
  for (const v of relevant) {
    byUser[v.userId] = v.option;
    counts[v.option] = (counts[v.option] || 0) + 1;
  }
  const responded = audience.filter((u) => byUser[u.id] !== undefined).map((u) => u.id);
  const notResponded = audience.filter((u) => byUser[u.id] === undefined).map((u) => u.id);
  return { counts, byUser, responded, notResponded };
}
