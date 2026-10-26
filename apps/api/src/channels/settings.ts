import { mergeChannelsConfig, sanitizeChannelsConfig, type ChannelsConfig } from "@peebee/shared";
import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Every Channels option lives in one Admin-controlled setting. The field list, defaults and limits
 * are in @peebee/shared (so the Admin app draws its screen from the same list); anything stored or
 * submitted is clamped to them here.
 */
export function parseChannelsConfig(raw: string): ChannelsConfig {
  try {
    return sanitizeChannelsConfig(JSON.parse(raw));
  } catch {
    return sanitizeChannelsConfig({});
  }
}

export async function getChannelsConfig(): Promise<ChannelsConfig> {
  return parseChannelsConfig(await getSetting("channels_config"));
}

export async function saveChannelsConfig(patch: unknown): Promise<{ before: ChannelsConfig; after: ChannelsConfig }> {
  const before = await getChannelsConfig();
  const after = mergeChannelsConfig(before, patch);
  await setSetting("channels_config", JSON.stringify(after));
  return { before, after };
}
