import { getServicesPlatformSettings } from "../services-platform/settings.js";
import { getOptions } from "./option-settings.js";

/** The ways money can reach a service business. */
export type ServiceRail = "momo_mtn" | "momo_airtel" | "cash_at_venue" | "bank_wire";
export const SERVICE_RAILS: ServiceRail[] = ["momo_mtn", "momo_airtel", "cash_at_venue", "bank_wire"];
export const isOnlineRail = (rail: string): boolean => rail === "momo_mtn" || rail === "momo_airtel";

/**
 * Structural rail for intangible goods. A card processor can freeze an account over disputes about services nobody can
 * hold, so while the admin switch "disallow aggregators for intangibles" is on (the default) a service is only ever
 * collected through providers that push a mobile-money prompt to the customer's phone — never a hosted checkout that
 * could take a card. Turning the switch off lets hosted providers be used too. Every services payment asks here.
 */
export async function serviceCollectionIsDirectPushOnly(): Promise<boolean> {
  return (await getServicesPlatformSettings()).disallowAggregatorForIntangibles;
}

/** The rails a business really offers: its own list, narrowed by what the platform allows for services. */
export async function railsOffered(businessRails: string[]): Promise<ServiceRail[]> {
  const platform = (await getOptions(["services_enabled_rails"])).services_enabled_rails as string[];
  return businessRails.filter((r): r is ServiceRail => (SERVICE_RAILS as string[]).includes(r) && platform.includes(r));
}
