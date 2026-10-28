/**
 * Over-the-air updates for the bundled mobile apps. A phone app (Capacitor) carries its own copy of the web app; the
 * update server hands it a newer copy so a fix reaches phones without a new APK. Admin decides which published
 * version is live. Only the customer app has this today.
 */
export const APP_UPDATE_APPS = ["customer"] as const;
export type AppUpdateApp = (typeof APP_UPDATE_APPS)[number];

export const APP_UPDATE_LABELS: Record<AppUpdateApp, string> = { customer: "Customer app (Android)" };

/**
 * One published copy of an app's screens: a list of files (path, checksum, size) kept on the server. A phone compares the
 * list with the files it already has, including the ones built into the APK, and downloads only the ones that differ.
 */
export type AppUpdateVersion = {
  /** Unique, URL-safe: what the phone is told is the new version. */
  id: string;
  /** A short name for people, such as the commit that built it. */
  label: string;
  /** How many files the copy has. */
  files: number;
  /** All of its files together, in bytes (what is on the phone once installed, not what is downloaded). */
  size: number;
  /** The oldest Android build (versionCode) this copy can run on. Older installs are told to update the app itself. */
  minNative: number;
  note: string;
  publishedAt: string;
};

/** Every version kept for one app, and which one phones are given. */
export type AppUpdateRegistry = { live: string | null; versions: AppUpdateVersion[] };

/** What Admin → App updates shows and edits. */
export type AppUpdatesSettings = {
  /** The master switch: off, phones are told they are up to date and keep what they have. */
  enabled: boolean;
  /** A newly published version becomes live straight away; off, it waits until Admin makes it live. */
  autoLive: boolean;
  /** The publish token is set on the server, so the build pipeline can upload. */
  publishConfigured: boolean;
  apps: Record<AppUpdateApp, AppUpdateRegistry>;
};

export type AppUpdatesUpdate = {
  enabled?: boolean;
  autoLive?: boolean;
  /** Make a version live (or null to stop updating that app). */
  live?: Partial<Record<AppUpdateApp, string | null>>;
  /** Delete old versions (never the live one). */
  remove?: Array<{ app: AppUpdateApp; id: string }>;
};
