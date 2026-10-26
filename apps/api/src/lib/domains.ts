/** Hostnames merchants may connect to their web store. */

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** A clean, lowercase hostname, or null when it is not one a store may use. */
export function normalizeHostname(input: string): string | null {
  let host = input.trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (host.length > 253 || host.includes(":") || host.includes("@")) return null;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  if (/^\d+(\.\d+)*$/.test(host)) return null; // an IP address
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld)) return null;
  // Peebee's own domain is never a "custom" domain, and neither are names that could pass for it.
  if (host === "peebee.online" || host.endsWith(".peebee.online") || host.endsWith(".workers.dev")) return null;
  if (labels.includes("localhost")) return null;
  return host;
}

export const VERIFY_PREFIX = "_peebee-verify";

export function verifyRecordName(domain: string): string {
  return `${VERIFY_PREFIX}.${domain}`;
}

export function verifyRecordValue(token: string): string {
  return `peebee-verify=${token}`;
}

type Fetch = (input: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * Does the domain publish our verification TXT record? Uses DNS-over-HTTPS (works from a Worker). `fetchImpl` is
 * injectable so tests need no network.
 */
export async function domainHasVerificationRecord(domain: string, token: string, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(verifyRecordName(domain))}&type=TXT`, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { Answer?: Array<{ type?: number; data?: string }> };
    const want = verifyRecordValue(token);
    return (body.Answer ?? []).some((a) => a.type === 16 && String(a.data ?? "").replace(/"/g, "").trim() === want);
  } catch {
    return false;
  }
}

/** Test seam: the DNS lookup used by the verify endpoint. */
let lookup: typeof domainHasVerificationRecord = domainHasVerificationRecord;
export function setDomainLookupForTests(fn: typeof domainHasVerificationRecord | null): void {
  lookup = fn ?? domainHasVerificationRecord;
}
export function checkDomain(domain: string, token: string): Promise<boolean> {
  return lookup(domain, token);
}
