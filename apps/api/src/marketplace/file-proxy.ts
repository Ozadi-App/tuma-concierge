import { parsePublicHttpsUrl } from "../video/url-guard.js";

/** Only admin-trusted file hosts may receive server-side requests. Merchants
 * cannot authorize their own domains (including domains resolving privately).
 * Trust includes the host's DNS and its operators; wildcards are unsupported. */
export function trustedFileUrl(raw: string, hosts: string[]): URL | null {
  const url = parsePublicHttpsUrl(raw);
  if (!url || url.hostname.includes(":") || /^[\d.]+$/.test(url.hostname)) return null;
  return hosts.includes(url.hostname) ? url : null;
}

export async function fetchTrustedFile(raw: string, hosts: string[]): Promise<Response | null> {
  let url = trustedFileUrl(raw, hosts);
  if (!url) return null;
  const signal = AbortSignal.timeout(30000);
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(url.href, { redirect: "manual", signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) return null;
    url = trustedFileUrl(new URL(location, url).href, hosts);
    if (!url) return null;
  }
  return null;
}
