import { getSetting, setSetting } from "../lib/settings.js";
import type { ServicesPlatformSettings } from "@peebee/shared";

export async function getServicesPlatformSettings(): Promise<ServicesPlatformSettings> {
  const [
    enabledStr,
    commissionStr,
    leadTimeStr,
    maxServicesStr,
    disallowAggregatorStr,
    virtualEnabledStr,
  ] = await Promise.all([
    getSetting("services_platform_enabled"),
    getSetting("services_platform_commission_percent"),
    getSetting("services_platform_lead_time_hours"),
    getSetting("services_platform_max_services"),
    getSetting("services_platform_disallow_aggregator_intangibles"),
    getSetting("services_platform_virtual_enabled"),
  ]);

  return {
    enabled: enabledStr !== "0",
    commissionPercent: Math.max(0, Math.min(100, Number(commissionStr) || 5)),
    leadTimeHours: Math.max(0, Number(leadTimeStr) || 2),
    maxServicesPerBusiness: Math.max(1, Number(maxServicesStr) || 50),
    disallowAggregatorForIntangibles: disallowAggregatorStr !== "0",
    virtualConsultationsEnabled: virtualEnabledStr !== "0",
  };
}

export async function setServicesPlatformSettings(next: Partial<ServicesPlatformSettings>): Promise<void> {
  const writes: Promise<void>[] = [];
  if (next.enabled != null) writes.push(setSetting("services_platform_enabled", next.enabled ? "1" : "0"));
  if (next.commissionPercent != null) writes.push(setSetting("services_platform_commission_percent", String(Math.max(0, Math.min(100, next.commissionPercent)))));
  if (next.leadTimeHours != null) writes.push(setSetting("services_platform_lead_time_hours", String(Math.max(0, Math.round(next.leadTimeHours)))));
  if (next.maxServicesPerBusiness != null) writes.push(setSetting("services_platform_max_services", String(Math.max(1, Math.round(next.maxServicesPerBusiness)))));
  if (next.disallowAggregatorForIntangibles != null) writes.push(setSetting("services_platform_disallow_aggregator_intangibles", next.disallowAggregatorForIntangibles ? "1" : "0"));
  if (next.virtualConsultationsEnabled != null) writes.push(setSetting("services_platform_virtual_enabled", next.virtualConsultationsEnabled ? "1" : "0"));
  await Promise.all(writes);
}
