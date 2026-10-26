import { logActivity } from "../admin/activity.js";
import { getRawSetting, setRawSetting } from "./settings.js";
import { hasColumn, hasTable } from "./schema.js";
import { smsIsReal } from "./sms-gateway.js";
import { r2IsReady } from "../storage/r2.js";
import {
  OPTION_SETTINGS,
  choiceAvailability,
  decodeValue,
  encodeValue,
  getSettingDef,
  resolveEffective,
  validateValue,
  type OptionModule,
  type OptionValue,
  type SchemaProbe,
  type SettingDef,
} from "./option-registry.js";

type Actor = Parameters<typeof logActivity>[0]["actor"];

/** Looks up, once, every table and column any option depends on, so availability checks are synchronous afterwards. */
export async function loadSchemaProbe(): Promise<SchemaProbe> {
  const tables = new Set<string>();
  const columns = new Set<string>();
  for (const def of OPTION_SETTINGS) {
    if (def.kind !== "enum" && def.kind !== "multi") continue;
    for (const o of def.options) {
      o.requires?.tables?.forEach((t) => tables.add(t));
      o.requires?.columns?.forEach(([t, c]) => columns.add(`${t}.${c}`));
    }
  }
  const have = new Set<string>();
  const smsReady = await smsIsReal();
  const r2Ready = r2IsReady();
  await Promise.all([
    ...[...tables].map(async (t) => { if (await hasTable(t)) have.add(`t:${t}`); }),
    ...[...columns].map(async (tc) => { const [t, c] = tc.split("."); if (await hasColumn(t, c)) have.add(`c:${tc}`); }),
  ]);
  return {
    hasTable: (name) => have.has(`t:${name}`),
    hasColumn: (table, column) => have.has(`c:${table}.${column}`),
    smsReady: () => smsReady,
    r2Ready: () => r2Ready,
  };
}

/** The value the running code should act on for one setting (stored choice, or the first working option if it is unavailable). */
export async function getOption<T extends OptionValue = OptionValue>(key: string): Promise<T> {
  const def = getSettingDef(key);
  if (!def) throw new Error(`Unknown option setting: ${key}`);
  const stored = decodeValue(def, await getRawSetting(key));
  if (def.kind !== "enum" && def.kind !== "multi") return stored as T;
  return resolveEffective(def, stored, await loadSchemaProbe()) as T;
}

/** Several at once, sharing one schema probe. */
export async function getOptions(keys: string[]): Promise<Record<string, OptionValue>> {
  const probe = await loadSchemaProbe();
  const out: Record<string, OptionValue> = {};
  for (const key of keys) {
    const def = getSettingDef(key);
    if (!def) throw new Error(`Unknown option setting: ${key}`);
    const stored = decodeValue(def, await getRawSetting(key));
    out[key] = def.kind === "enum" || def.kind === "multi" ? resolveEffective(def, stored, probe) : stored;
  }
  return out;
}

export type OptionView = {
  key: string;
  module: OptionModule;
  kind: SettingDef["kind"];
  label: string;
  description: string;
  value: OptionValue;
  effective: OptionValue;
  default: OptionValue;
  min?: number;
  max?: number;
  unit?: string;
  maxItems?: number;
  itemHint?: string;
  options?: Array<{ value: string; label: string; hint?: string; recommended: boolean; available: boolean; reason?: "not_built" | "migration_pending" | "sms_provider_pending" | "storage_pending"; migration?: string }>;
};

/** What the admin page renders: every setting with its stored value, the value in force, and which options can be chosen. */
export async function describeOptions(module?: OptionModule): Promise<OptionView[]> {
  const probe = await loadSchemaProbe();
  const out: OptionView[] = [];
  for (const def of OPTION_SETTINGS) {
    if (module && def.module !== module) continue;
    const value = decodeValue(def, await getRawSetting(def.key));
    const view: OptionView = {
      key: def.key, module: def.module, kind: def.kind, label: def.label, description: def.description,
      value, effective: def.kind === "enum" || def.kind === "multi" ? resolveEffective(def, value, probe) : value, default: def.default,
    };
    if (def.kind === "int") Object.assign(view, { min: def.min, max: def.max, unit: def.unit });
    if (def.kind === "list") Object.assign(view, { maxItems: def.maxItems, itemHint: def.itemHint });
    if (def.kind === "enum" || def.kind === "multi") {
      view.options = def.options.map((o) => {
        const a = choiceAvailability(o, probe);
        return { value: o.value, label: o.label, hint: o.hint, recommended: Boolean(o.recommended) || (def.kind === "enum" ? def.default === o.value : def.default.includes(o.value)), available: a.available, reason: a.reason, migration: o.requires?.migration };
      });
    }
    out.push(view);
  }
  return out;
}

export type SetOptionsResult = { ok: true; changed: string[] } | { ok: false; errors: Record<string, string> };

/** Validate and store a batch of admin changes, all or nothing, and record who changed what. */
export async function setOptions(patch: Record<string, unknown>, actor: Actor, ip?: string | null): Promise<SetOptionsResult> {
  const probe = await loadSchemaProbe();
  const errors: Record<string, string> = {};
  const accepted: Array<{ def: SettingDef; value: OptionValue }> = [];
  for (const [key, input] of Object.entries(patch)) {
    const def = getSettingDef(key);
    if (!def) { errors[key] = "Unknown setting."; continue; }
    const result = validateValue(def, input, probe);
    if (!result.ok) errors[key] = result.message;
    else accepted.push({ def, value: result.value });
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const before: Record<string, OptionValue> = {};
  const after: Record<string, OptionValue> = {};
  for (const { def, value } of accepted) {
    const previous = decodeValue(def, await getRawSetting(def.key));
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    before[def.key] = previous;
    after[def.key] = value;
    await setRawSetting(def.key, encodeValue(def, value));
  }
  const changed = Object.keys(after);
  if (changed.length > 0) {
    await logActivity({
      actor, action: "settings.update", entityType: "option_settings",
      summary: `Changed ${changed.length === 1 ? getSettingDef(changed[0])?.label : `${changed.length} store, digital, learning and services options`}`,
      before, after, ip: ip ?? null,
    });
  }
  return { ok: true, changed };
}
