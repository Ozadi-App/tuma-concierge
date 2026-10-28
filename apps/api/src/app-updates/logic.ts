import { APP_UPDATE_APPS, type AppUpdateApp, type AppUpdateRegistry, type AppUpdateVersion } from "@peebee/shared";

/** How many published versions are kept per app; older ones are deleted. The live one is always kept. */
export const MAX_KEPT_VERSIONS = 10;
/** The largest single file the server accepts (the app's biggest assets are a few MB). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Limits on one published copy, so a mistake cannot fill the storage. */
export const MAX_FILES_PER_VERSION = 5000;
export const MAX_VERSION_BYTES = 250 * 1024 * 1024;

export const isUpdateApp = (value: string): value is AppUpdateApp => (APP_UPDATE_APPS as readonly string[]).includes(value);

/** Lower-case letters, digits, dot, dash and underscore: safe in a URL and a storage key. */
export const isValidVersionId = (id: string): boolean => /^[a-z0-9][a-z0-9._-]{2,63}$/.test(id);

export const fileKey = (app: AppUpdateApp, sha256: string): string => `app-updates/${app}/files/${sha256}`;
export const manifestKey = (app: AppUpdateApp, id: string): string => `app-updates/${app}/manifests/${id}.json`;

export const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/** A path inside the app (as in the build's output folder): relative, no "..", no odd characters. */
export const isSafePath = (path: unknown): path is string =>
  typeof path === "string" && path.length > 0 && path.length <= 300 && !path.startsWith("/") && !path.split("/").some((part) => part === "" || part === "." || part === "..") && /^[A-Za-z0-9._~@()+,=$\-\/ \[\]%]+$/.test(path);

export type ManifestEntry = { path: string; sha256: string; size: number };

/** Reads a stored manifest, or null when it is missing or malformed. */
export function parseManifest(raw: string | null | undefined): ManifestEntry[] | null {
  try {
    const list = JSON.parse(raw ?? "") as unknown;
    if (!Array.isArray(list)) return null;
    const entries = list.flatMap((e): ManifestEntry[] => {
      const x = e as Record<string, unknown>;
      return isSafePath(x?.path) && isSha256(x?.sha256) ? [{ path: x.path, sha256: x.sha256, size: Math.max(0, Math.floor(Number(x.size) || 0)) }] : [];
    });
    return entries.length === list.length ? entries : null;
  } catch {
    return null;
  }
}

export const EMPTY_REGISTRY: AppUpdateRegistry = { live: null, versions: [] };

/** Reads a stored registry, dropping anything malformed instead of failing. */
export function parseRegistry(raw: string | undefined): AppUpdateRegistry {
  try {
    const value = JSON.parse(raw || "{}") as { live?: unknown; versions?: unknown };
    const versions = (Array.isArray(value.versions) ? value.versions : []).flatMap((entry): AppUpdateVersion[] => {
      const v = entry as Record<string, unknown>;
      if (typeof v?.id !== "string" || !isValidVersionId(v.id)) return [];
      return [{
        id: v.id,
        label: typeof v.label === "string" ? v.label.slice(0, 80) : v.id,
        files: Number.isFinite(Number(v.files)) ? Math.max(0, Math.floor(Number(v.files))) : 0,
        size: Number.isFinite(Number(v.size)) ? Math.max(0, Math.floor(Number(v.size))) : 0,
        minNative: Number.isFinite(Number(v.minNative)) ? Math.max(1, Math.floor(Number(v.minNative))) : 1,
        note: typeof v.note === "string" ? v.note.slice(0, 200) : "",
        publishedAt: typeof v.publishedAt === "string" ? v.publishedAt : "",
      }];
    });
    const live = typeof value.live === "string" && versions.some((v) => v.id === value.live) ? value.live : null;
    return { live, versions };
  } catch {
    return { live: null, versions: [] };
  }
}

export type CheckAnswer =
  | { kind: "update"; version: AppUpdateVersion }
  | { kind: "up_to_date"; message: string }
  | { kind: "blocked"; error: string; message: string };

/**
 * What to tell a phone that asks "is there something newer?". `versionName` is the copy it runs now (the one inside
 * the APK reads "builtin"); `versionCode` is its Android build number.
 */
export function decideCheck(enabled: boolean, registry: AppUpdateRegistry, device: { versionName?: unknown; versionCode?: unknown }): CheckAnswer {
  if (!enabled) return { kind: "up_to_date", message: "Updates are paused" };
  const live = registry.live ? registry.versions.find((v) => v.id === registry.live) : undefined;
  if (!live) return { kind: "up_to_date", message: "No update has been published" };
  if (device.versionName === live.id) return { kind: "up_to_date", message: "Already on the latest version" };
  const code = Number.parseInt(String(device.versionCode ?? ""), 10);
  if (Number.isFinite(code) && code < live.minNative) {
    return { kind: "blocked", error: "native_update_required", message: "This update needs a newer version of the app itself" };
  }
  return { kind: "update", version: live };
}

/**
 * Adds a published version. With `autoLive` it also becomes the live one. Returns the ids that fell out of the kept
 * window so their files can be deleted. Publishing an id that exists replaces it.
 */
export function addVersion(registry: AppUpdateRegistry, version: AppUpdateVersion, autoLive: boolean): { registry: AppUpdateRegistry; removed: string[] } {
  const live = autoLive ? version.id : registry.live;
  const all = [version, ...registry.versions.filter((v) => v.id !== version.id)].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const kept = all.filter((v, i) => i < MAX_KEPT_VERSIONS || v.id === live);
  const keptIds = new Set(kept.map((v) => v.id));
  return { registry: { live, versions: kept }, removed: all.filter((v) => !keptIds.has(v.id)).map((v) => v.id) };
}

/** Compares two secrets without stopping at the first difference. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
