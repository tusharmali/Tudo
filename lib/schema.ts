/**
 * The single source of truth for the Google Sheet "database".
 * Each key is a tab (table); the array is that tab's header row (columns).
 * `npm run init-sheet` reads this to build every tab automatically.
 */
export type SheetName =
  | "Users"
  | "Attendance"
  | "AttendanceConfig"
  | "LeaveRequests"
  | "Tasks"
  | "WIP"
  | "Concerns"
  | "ConcernReplies"
  | "Chats"
  | "Messages"
  | "Reactions"
  | "Releases"
  | "FunActivity"
  | "FunContributions"
  | "Notifications"
  | "PushSubscriptions"
  | "Settings"
  | "Kudos"
  | "Shoots"
  | "Milestones"
  | "AuditLog";

export const SCHEMA: Record<SheetName, string[]> = {
  Users: ["id", "name", "handle", "email", "passwordHash", "role", "department", "avatarColor", "avatar", "phone", "status", "createdAt"],
  Attendance: ["id", "userId", "date", "checkIn", "checkOut", "type", "status", "lat", "lng", "accuracy", "distanceM", "notes"],
  AttendanceConfig: ["key", "value"],
  LeaveRequests: ["id", "userId", "type", "fromDate", "toDate", "reason", "status", "decidedBy", "decidedAt", "createdAt"],
  Tasks: ["id", "userId", "date", "parentId", "content", "weekTarget", "section", "status", "updateText", "order", "createdBy", "createdAt"],
  WIP: ["id", "userId", "date", "content", "createdAt"],
  Concerns: ["id", "fromUserId", "toUserId", "subject", "message", "status", "createdAt"],
  ConcernReplies: ["id", "concernId", "userId", "message", "createdAt"],
  Chats: ["id", "type", "name", "department", "memberIds", "formerMembers", "createdBy", "createdAt"],
  Messages: ["id", "chatId", "fromUserId", "content", "createdAt"],
  Reactions: ["id", "messageId", "userId", "emoji", "createdAt"],
  Releases: ["id", "title", "scheduledDate", "points", "resources", "status", "createdAt"],
  FunActivity: ["id", "title", "isActive", "config", "createdAt"],
  FunContributions: ["id", "activityId", "userId", "content", "createdAt"],
  Notifications: ["id", "title", "body", "target", "createdBy", "url", "createdAt"],
  PushSubscriptions: ["id", "userId", "endpoint", "p256dh", "auth", "createdAt"],
  Settings: ["key", "value"],
  Kudos: ["id", "fromUserId", "toUserId", "category", "message", "createdAt"],
  Shoots: ["id", "client", "title", "date", "status", "assigneeId", "notes", "createdBy", "createdAt"],
  Milestones: ["id", "userId", "title", "targetDate", "status", "notes", "createdBy", "createdAt"],
  AuditLog: ["id", "actorId", "actorName", "category", "action", "detail", "createdAt"],
};

/** Seeded into the Settings tab on init (only if the key is missing). */
export const SETTINGS_DEFAULTS: Record<string, string> = {
  "org.name": "Tudo",
  "fun.enabled": "false",
  "ai.model": "openai/gpt-oss-20b:free",
};

/** Seeded into the AttendanceConfig tab on init (only if the key is missing). */
export const ATTENDANCE_CONFIG_DEFAULTS: Record<string, string> = {
  officeLat: "0",
  officeLng: "0",
  radiusM: "150",
  minAccuracyM: "75",
  workStart: "10:00",
  graceMin: "15",
};
