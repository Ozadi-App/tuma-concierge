import { AI_FEATURES, isAiFeature, type AiFeatureId, type AiFeaturesOverview, type AiFeatureStatus } from "@peebee/shared";
import { logActivity } from "../admin/activity.js";
import type { RequestUser } from "../auth/middleware.js";
import { getOption, setOptions } from "../lib/option-settings.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { getLugandaAudioSettings, setLugandaAudioSettings } from "../lib/settings.js";
import { addKeys, keysSeparate, listKeys, setKeysSeparate, withGeminiKey, type AddResult, type Pool } from "../speech/ai-keys.js";

/**
 * AI features: one place that knows every feature that calls a model (the list is in packages/shared/src/ai-features.ts).
 * To add a feature: add it to AI_FEATURES, add its on/off switch to FEATURE_HOOKS below (the compiler will not let you
 * forget), and make its model call through withFeatureKey. It then shows up in Admin → AI features with its own switch
 * and, when the admin separates the keys, its own key pool.
 */

type Actor = RequestUser;
type SetResult = { ok: true } | { ok: false; message: string };

/** How each feature's on/off switch is read and written. Those switches already live where the admin expects them. */
const FEATURE_HOOKS: Record<AiFeatureId, { isEnabled(): Promise<boolean>; setEnabled(on: boolean, actor: Actor, ip: string | null): Promise<SetResult> }> = {
  translation: {
    isEnabled: async () => (await getLugandaAudioSettings()).enabled,
    async setEnabled(on, actor, ip) {
      const before = (await getLugandaAudioSettings()).enabled;
      await setLugandaAudioSettings({ enabled: on });
      await logActivity({ actor, action: "ai_features.enabled", entityType: "settings", summary: `Luganda translation and read-aloud ${on ? "turned on" : "turned off"}`, before: { enabled: before }, after: { enabled: on }, ip });
      return { ok: true };
    },
  },
  support_chat: {
    isEnabled: async () => (await getOption("support_chat_ai_enabled")) === true,
    async setEnabled(on, actor, ip) {
      const result = await setOptions({ support_chat_ai_enabled: on }, actor, ip);
      return result.ok ? { ok: true } : { ok: false, message: Object.values(result.errors)[0] ?? "Could not save" };
    },
  },
};

/** Runs a model call for one AI feature with that feature's keys (its own, or the shared pool). */
export function withFeatureKey<T>(feature: AiFeatureId, model: string, use: (apiKey: string) => Promise<T>): Promise<T> {
  return withGeminiKey(model, use, feature);
}

export async function isFeatureEnabled(feature: AiFeatureId): Promise<boolean> {
  return FEATURE_HOOKS[feature].isEnabled();
}

const featureColumn = () => hasColumn("ai_api_keys", "feature");

/** The pools that have to be able to work right now: each enabled feature's own pool when separated, otherwise the shared one. */
export async function poolsInUse(): Promise<Array<{ pool: Pool; label: string }>> {
  if (!(await keysSeparate())) return [{ pool: null, label: "the shared keys" }];
  const out: Array<{ pool: Pool; label: string }> = [];
  for (const f of AI_FEATURES) if (await FEATURE_HOOKS[f.id].isEnabled()) out.push({ pool: f.id, label: f.label });
  return out;
}

export async function aiFeaturesOverview(): Promise<AiFeaturesOverview> {
  const available = (await hasTable("ai_api_keys")) && (await featureColumn());
  const separate = await keysSeparate();
  const shared = (await listKeys(null)).filter((k) => k.enabled);
  const features: AiFeatureStatus[] = [];
  for (const f of AI_FEATURES) {
    const own = available ? (await listKeys(f.id)).filter((k) => k.enabled) : [];
    features.push({
      id: f.id, label: f.label, description: f.description,
      enabled: await FEATURE_HOOKS[f.id].isEnabled(),
      pool: separate ? "own" : "shared",
      ownKeys: own.length, ownReady: own.filter((k) => k.status === "ready").length,
      needsKey: separate && own.length === 0,
    });
  }
  return { separate, separateAvailable: available, sharedKeys: shared.length, sharedReady: shared.filter((k) => k.status === "ready").length, features };
}

export type ChangeResult =
  | { ok: true; results: Partial<Record<AiFeatureId, AddResult[]>> }
  | { ok: false; status: 400 | 409 | 503; error: string; message: string; missing?: Array<{ id: AiFeatureId; label: string }>; results?: Partial<Record<AiFeatureId, AddResult[]>> };

/**
 * Separate the keys (each feature gets its own) or put them back together (one shared pool).
 * Separating needs a working key for every feature that is on: keys passed in `keys` are checked with Google and added
 * first, and if a feature that is on still has none, nothing changes and the answer says which ones are missing.
 */
export async function setSeparate(separate: boolean, keys: Partial<Record<string, string[]>>, actor: Actor, ip: string | null, createdBy: string): Promise<ChangeResult> {
  const before = await keysSeparate();
  if (!separate) {
    await setKeysSeparate(false);
    if (before) await logActivity({ actor, action: "ai_features.separate", entityType: "settings", summary: "AI keys: one shared pool for every AI feature", before: { separate: true }, after: { separate: false }, ip });
    return { ok: true, results: {} };
  }
  if (!(await hasTable("ai_api_keys")) || !(await featureColumn())) {
    return { ok: false, status: 503, error: "migration_pending", message: "Separating the keys is being set up (0152_ai_key_features.sql is not applied yet)." };
  }
  const results: Partial<Record<AiFeatureId, AddResult[]>> = {};
  for (const [id, list] of Object.entries(keys)) {
    if (!isAiFeature(id) || !list?.length) continue;
    results[id] = await addKeys(list.map((key) => ({ key })), createdBy, id);
  }
  const missing: Array<{ id: AiFeatureId; label: string }> = [];
  for (const f of AI_FEATURES) {
    if (!(await FEATURE_HOOKS[f.id].isEnabled())) continue;
    if ((await listKeys(f.id)).filter((k) => k.enabled).length === 0) missing.push({ id: f.id, label: f.label });
  }
  if (missing.length > 0) {
    return { ok: false, status: 400, error: "keys_required", message: `Add a separate key for: ${missing.map((m) => m.label).join(", ")}.`, missing, results };
  }
  await setKeysSeparate(true);
  if (!before) await logActivity({ actor, action: "ai_features.separate", entityType: "settings", summary: "AI keys: each AI feature now has its own keys", before: { separate: false }, after: { separate: true }, ip });
  return { ok: true, results };
}

/** Turn one feature on or off. With separated keys it cannot be turned on until it has a key of its own. */
export async function setFeatureEnabled(feature: AiFeatureId, enabled: boolean, actor: Actor, ip: string | null): Promise<SetResult & { status?: 409 }> {
  if (enabled && (await keysSeparate()) && (await listKeys(feature)).filter((k) => k.enabled).length === 0) {
    return { ok: false, status: 409, message: "The keys are separated, so add a key for this feature first." };
  }
  return FEATURE_HOOKS[feature].setEnabled(enabled, actor, ip);
}
