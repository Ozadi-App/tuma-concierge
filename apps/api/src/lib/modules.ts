import { MODULES, getModule, resolveModuleAvailability, type ModuleFlags, type ModuleSettings, type ModuleSettingsUpdate } from "@peebee/shared";
import { getSetting, getSettingRaw, rawModuleLive, setSetting, type SettingKey } from "./settings.js";

function parse(raw: string): Record<string, boolean> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? (value as Record<string, boolean>) : {};
  } catch { return {}; }
}

/** Every module's two switches exactly as stored (before the modules above it are applied). */
export async function getModuleFlags(): Promise<ModuleFlags> {
  const [liveJson, practiceJson] = await Promise.all([getSettingRaw("modules_live"), getSettingRaw("modules_practice")]);
  const live = parse(liveJson);
  const practice = parse(practiceJson);
  const values = new Map<string, string>([["modules_live", liveJson]]);
  await Promise.all(MODULES.filter((x) => x.liveKey).map(async (x) => values.set(x.liveKey!, await getSettingRaw(x.liveKey as SettingKey))));
  return Object.fromEntries(MODULES.map((x) => [x.key, { live: rawModuleLive(x, values), practice: practice[x.key] !== false }]));
}

export async function getModuleSettings(): Promise<ModuleSettings> {
  const flags = await getModuleFlags();
  return { flags, available: resolveModuleAvailability(flags) };
}

/** Is this module on in Live right now, counting every module above it? */
export async function isModuleLive(key: string): Promise<boolean> {
  const def = getModule(key);
  if (!def) return true;
  const liveJson = await getSettingRaw("modules_live");
  const values = new Map<string, string>([["modules_live", liveJson]]);
  const chain = [def];
  for (let up = def.parent ? getModule(def.parent) : undefined; up; up = up.parent ? getModule(up.parent) : undefined) chain.push(up);
  await Promise.all(chain.filter((x) => x.liveKey).map(async (x) => values.set(x.liveKey!, await getSettingRaw(x.liveKey as SettingKey))));
  return chain.every((x) => rawModuleLive(x, values));
}

/** Only the keys that exist: anything else in an update is a mistake worth refusing. */
export function unknownModuleKeys(update: ModuleSettingsUpdate): string[] {
  return [...Object.keys(update.live ?? {}), ...Object.keys(update.practice ?? {})].filter((k) => !getModule(k));
}

export async function setModuleFlags(update: ModuleSettingsUpdate): Promise<void> {
  const liveJson = parse(await getSettingRaw("modules_live"));
  let liveJsonChanged = false;
  for (const [key, on] of Object.entries(update.live ?? {})) {
    const def = getModule(key);
    if (!def) continue;
    if (def.liveKey) await setSetting(def.liveKey as SettingKey, on ? "1" : "0", { force: true });
    else { liveJson[key] = on; liveJsonChanged = true; }
  }
  if (liveJsonChanged) await setSetting("modules_live", JSON.stringify(liveJson));
  const practiceUpdate = Object.entries(update.practice ?? {}).filter(([k]) => getModule(k));
  if (practiceUpdate.length) {
    const practiceJson = parse(await getSettingRaw("modules_practice"));
    for (const [key, on] of practiceUpdate) practiceJson[key] = on;
    await setSetting("modules_practice", JSON.stringify(practiceJson));
  }
}

/** Boda, Luxury and Ambulance have no older setting, so the booking routes ask here. */
