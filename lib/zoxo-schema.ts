/**
 * Zoxo backend — the shape of the "Zoxo Backend" Google Sheet.
 * `npm run init-zoxo` builds every tab from this file.
 *
 * Zoxo (the Chrome extension by Tushar Mali) never uploads media. These tabs
 * hold usage metadata only: who did what, where and when.
 */
export type ZoxoSheetName = "Testers" | "Events" | "Sessions" | "Config";

export const ZOXO_SCHEMA: Record<ZoxoSheetName, string[]> = {
  Testers: [
    "id",
    "email",
    "name",
    "deviceId",
    "os",
    "browser",
    "screen",
    "timezone",
    "locale",
    "extVersion",
    "firstSeenAt",
    "lastSeenAt",
    "sessions",
    "events",
    "status",
  ],
  Events: [
    "id",
    "ts",
    "date",
    "testerId",
    "email",
    "name",
    "type",
    "mode",
    "page",
    "pageTitle",
    "durationMs",
    "sizeBytes",
    "width",
    "height",
    "format",
    "meta",
    "deviceId",
    "os",
    "browser",
    "extVersion",
  ],
  Sessions: ["id", "testerId", "email", "startedAt", "reason", "os", "browser", "extVersion"],
  Config: ["key", "value"],
};

/** Seeded into Config on init; the extension picks these up when it registers. */
export const ZOXO_CONFIG_DEFAULTS: Record<string, string> = {
  "notice": "",
  "min.version": "1.0.0",
  "telemetry.enabled": "true",
  "url.logging": "path",
};

export const ZOXO_EVENT_TYPES = [
  "session.start",
  "auth.signin",
  "auth.signout",
  "capture.visible",
  "capture.fullpage",
  "capture.region",
  "capture.element",
  "capture.desktop",
  "capture.scroller",
  "record.start",
  "record.stop",
  "record.cancel",
  "edit.save",
  "export.download",
  "export.copy",
  "export.gif",
  "video.export",
  "library.delete",
  "error",
] as const;
