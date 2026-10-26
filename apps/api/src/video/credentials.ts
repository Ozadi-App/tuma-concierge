/**
 * Provider API keys, stored AES-256-GCM encrypted in video_credentials. owner = "platform" holds
 * Peebee's own accounts (with an env-var fallback); any other owner is a creator's user id and holds
 * the account they brought. Values are never returned to a client once saved — only whether each
 * field is set.
 */
import { db } from "../db/client.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { hasTable } from "../lib/schema.js";
import { VIDEO_ADAPTERS } from "./adapters/index.js";
import type { VideoCredentials, VideoProviderKey } from "./types.js";

export const PLATFORM = "platform";

function fieldsOf(provider: VideoProviderKey) {
  return VIDEO_ADAPTERS[provider].credentialFields;
}

async function readStored(owner: string, provider: VideoProviderKey): Promise<Record<string, string>> {
  if (!(await hasTable("video_credentials"))) return {};
  const res = await db.execute({ sql: "SELECT field, value FROM video_credentials WHERE owner = ? AND provider = ?", args: [owner, provider] });
  const out: Record<string, string> = {};
  for (const row of res.rows as unknown as Array<{ field: string; value: string }>) {
    try {
      out[row.field] = await decryptSecret(row.value);
    } catch {
      /* an unreadable value counts as not set */
    }
  }
  return out;
}

/** The decrypted credentials for one account. The platform account falls back to env vars per field. */
export async function loadCredentials(owner: string, provider: VideoProviderKey): Promise<VideoCredentials> {
  const stored = await readStored(owner, provider);
  if (owner !== PLATFORM) return stored;
  const merged: VideoCredentials = { ...stored };
  for (const f of fieldsOf(provider)) {
    if (!merged[f.key] && f.envVar && process.env[f.envVar]) merged[f.key] = process.env[f.envVar]!;
  }
  return merged;
}

export function hasRequiredFields(provider: VideoProviderKey, creds: VideoCredentials): boolean {
  return fieldsOf(provider).filter((f) => f.required).every((f) => !!creds[f.key]);
}

/** Field-by-field "is it set" for a settings screen. Never the values. */
export async function credentialStatus(owner: string, provider: VideoProviderKey) {
  const creds = await loadCredentials(owner, provider);
  return fieldsOf(provider).map((f) => ({
    key: f.key, label: f.label, secret: f.secret, required: f.required, placeholder: f.placeholder, helpText: f.helpText, set: !!creds[f.key],
  }));
}

/** Saves the submitted fields (blank ones are left alone). Returns the keys that changed, for the activity log. */
export async function saveCredentials(owner: string, provider: VideoProviderKey, fields: Record<string, string>): Promise<string[]> {
  const valid = new Set(fieldsOf(provider).map((f) => f.key));
  const changed: string[] = [];
  for (const [key, raw] of Object.entries(fields)) {
    const value = raw.trim();
    if (!valid.has(key) || !value) continue;
    await db.execute({
      sql: `INSERT INTO video_credentials (owner, provider, field, value, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(owner, provider, field) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [owner, provider, key, await encryptSecret(value)],
    });
    changed.push(key);
  }
  return changed;
}

export async function clearCredentials(owner: string, provider: VideoProviderKey): Promise<void> {
  if (!(await hasTable("video_credentials"))) return;
  await db.execute({ sql: "DELETE FROM video_credentials WHERE owner = ? AND provider = ?", args: [owner, provider] });
}

export function validFieldKeys(provider: VideoProviderKey): string[] {
  return fieldsOf(provider).map((f) => f.key);
}
