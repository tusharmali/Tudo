import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { todayStr } from "@/lib/db";
import { listTasks, listBookmarks } from "@/lib/personal";
import MyClient from "./MyClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Space" };

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [tasks, bookmarks] = await Promise.all([listTasks(user.sub), listBookmarks(user.sub)]);
  return <MyClient today={todayStr()} tasks={tasks} bookmarks={bookmarks} />;
}
