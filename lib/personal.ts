/** Per-user private items — personal reminders/tasks and bookmarks. These are
 *  the member's own, never the company-assigned day-plan tasks. */
import { allRows, appendRow, updateWhere, deleteWhere, genId } from "./db";

export interface PersonalTask {
  id: string;
  userId: string;
  text: string;
  due: string; // optional YYYY-MM-DD
  done: string; // "true" | ""
  createdAt: string;
}

export interface Bookmark {
  id: string;
  userId: string;
  title: string;
  url: string;
  note: string;
  createdAt: string;
}

export async function listTasks(userId: string): Promise<PersonalTask[]> {
  const rows = (await allRows("PersonalTasks")) as unknown as PersonalTask[];
  return rows
    .filter((t) => t.userId === userId)
    .sort((a, b) => {
      const ad = a.done === "true" ? 1 : 0;
      const bd = b.done === "true" ? 1 : 0;
      if (ad !== bd) return ad - bd; // undone first
      const au = a.due || "9999";
      const bu = b.due || "9999";
      if (au !== bu) return au.localeCompare(bu); // soonest due first
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
}

export async function addTask(userId: string, text: string, due: string): Promise<void> {
  await appendRow("PersonalTasks", {
    id: genId("pt"),
    userId,
    text: text.trim().slice(0, 300),
    due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "",
    done: "",
    createdAt: new Date().toISOString(),
  });
}

export async function setTaskDone(id: string, userId: string, done: boolean): Promise<number> {
  return updateWhere("PersonalTasks", (r) => r.id === id && r.userId === userId, { done: done ? "true" : "" });
}

export async function removeTask(id: string, userId: string): Promise<number> {
  return deleteWhere("PersonalTasks", (r) => r.id === id && r.userId === userId);
}

export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const rows = (await allRows("Bookmarks")) as unknown as Bookmark[];
  return rows.filter((b) => b.userId === userId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function addBookmark(userId: string, title: string, url: string, note: string): Promise<void> {
  await appendRow("Bookmarks", {
    id: genId("bm"),
    userId,
    title: title.trim().slice(0, 200),
    url: url.trim().slice(0, 1000),
    note: note.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  });
}

export async function removeBookmark(id: string, userId: string): Promise<number> {
  return deleteWhere("Bookmarks", (r) => r.id === id && r.userId === userId);
}
