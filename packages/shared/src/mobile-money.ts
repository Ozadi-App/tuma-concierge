/**
 * Uganda mobile money network detection, shared by the API and both
 * customer/rider frontends so "which network is this number on" is answered
 * identically everywhere. Prefixes: MTN (077/078/076/039), Airtel
 * (070/075/074/020/025) — the same routing switches use for real.
 */

export type MobileMoneyNetwork = "mtn_momo" | "airtel_money";

const MTN_PREFIXES = ["77", "78", "76", "39"];
const AIRTEL_PREFIXES = ["70", "75", "74", "20", "25"];

export function normalizeUgandaMsisdn(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("256") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  return null;
}

export function detectMobileMoneyNetwork(msisdn: string): MobileMoneyNetwork | null {
  const normalized = normalizeUgandaMsisdn(msisdn);
  if (!normalized) return null;
  const prefix = normalized.slice(3, 5);
  if (MTN_PREFIXES.includes(prefix)) return "mtn_momo";
  if (AIRTEL_PREFIXES.includes(prefix)) return "airtel_money";
  return null;
}

export function mobileMoneyNetworkLabel(network: MobileMoneyNetwork | null): string {
  if (network === "mtn_momo") return "MTN MoMo";
  if (network === "airtel_money") return "Airtel Money";
  return "Mobile Money";
}

/** Yo! Payments' CurrencyCode field encodes both currency and network. */
export function mobileMoneyCurrencyCode(network: MobileMoneyNetwork): string {
  return network === "mtn_momo" ? "UGX-MTNMM" : "UGX-WARIDMM";
}
