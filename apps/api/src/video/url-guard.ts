/**
 * Guards for any address a creator hands us. Peebee fetches some of these (a link import checks the
 * file is really there) and plays all of them, so they must be public https addresses — never
 * something that reaches into Peebee's own network or a creator's local machine.
 */

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.1[89]\./, /^2(2[4-9]|[3-5]\d)\./,
];

/** True for host names that are an IP in a private/loopback/link-local range, or names that resolve locally. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return PRIVATE_V4.some((re) => re.test(host));
  // IPv6 literals: loopback, unspecified, unique-local, link-local, and v4-mapped.
  if (host.includes(":")) return host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith("::ffff:");
  // A bare number or hex/octal-looking host can be an IP in disguise.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true;
  return !host.includes(".");
}

/** A public https URL, or null. Credentials in the URL, odd ports and private hosts are refused. */
export function parsePublicHttpsUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (isPrivateHost(url.hostname)) return null;
  return url;
}

/** Hosts whose pages are not video files and whose terms forbid taking video from them this way. */
const NOT_A_VIDEO_FILE_HOSTS = ["youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch", "instagram.com", "vimeo.com", "twitter.com", "x.com"];

export function isSocialVideoPage(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return NOT_A_VIDEO_FILE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
