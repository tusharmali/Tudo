import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { todayStr } from "@/lib/db";
import { listTasks, listBookmarks, getNotes } from "@/lib/personal";
import MyClient from "./MyClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Space" };

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [tasks, bookmarks, notes] = await Promise.all([listTasks(user.sub), listBookmarks(user.sub), getNotes(user.sub)]);
  return <MyClient today={todayStr()} tasks={tasks} bookmarks={bookmarks} notes={notes} />;
}
