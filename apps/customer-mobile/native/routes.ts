// Dynamic-route shim for the bundled (static export) mobile build.
//
// A static export can only contain pages that exist at build time, but routes
// like /orders/[id] are keyed by data that only exists at runtime. In the
// mobile build every dynamic segment is therefore exported once with the
// placeholder "_" and the real values travel in the query string:
//
//   /orders/123/pay   ->   /orders/_/pay?_p_id=123
//
// `toNative` rewrites hrefs on the way out, `fromNative` restores the real
// pathname/params for the pages that read them. Both are only wired in by the
// mobile build (see apps/customer-mobile/next.config.ts).

export const PLACEHOLDER = "_";
const PARAM_PREFIX = "_p_";

type RouteTable = { dynamic: string[]; static: string[] };

function table(): RouteTable {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_NATIVE_ROUTES ?? "") as RouteTable;
  } catch {
    return { dynamic: [], static: [] };
  }
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Matches `segments` against a pattern like /orders/[id]/pay; returns the
 * captured params, or null. Literal segments must be equal. */
function match(pattern: string, segments: string[]): Record<string, string> | null {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const s = segments[i]!;
    if (p.startsWith("[") && p.endsWith("]")) {
      if (!s) return null;
      params[p.slice(1, -1)] = decodeURIComponent(s);
    } else if (p !== s) {
      return null;
    }
  }
  return params;
}

function bySpecificity(a: string, b: string): number {
  const lit = (r: string) => r.split("/").filter((s) => s && !s.startsWith("[")).length;
  return lit(b) - lit(a);
}

/** Rewrite an in-app href so it points at an exported page. Hrefs that are
 * external, hash-only, or already a real page are returned unchanged. */
export function toNative(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf("?");
  const rawPath = trimSlash(qAt >= 0 ? noHash.slice(0, qAt) : noHash);
  const query = qAt >= 0 ? noHash.slice(qAt + 1) : "";

  const { dynamic, static: staticRoutes } = table();
  if (staticRoutes.includes(rawPath)) return href;

  const segments = rawPath.split("/").filter(Boolean);
  for (const pattern of [...dynamic].sort(bySpecificity)) {
    const params = match(pattern, segments);
    if (!params) continue;
    const search = new URLSearchParams(query);
    for (const [name, value] of Object.entries(params)) search.set(PARAM_PREFIX + name, value);
    const path = pattern.replace(/\[[^\]]+\]/g, PLACEHOLDER);
    return `${path}?${search.toString()}${hash}`;
  }
  return href;
}

/** Inverse of `toNative` for a location the router reports: the real pathname
 * and the dynamic params, with the internal `_p_*` query keys stripped. */
export function fromNative(
  pathname: string,
  search: URLSearchParams,
): { pathname: string; params: Record<string, string>; search: URLSearchParams } {
  const clean = new URLSearchParams(search);
  const params: Record<string, string> = {};
  for (const [key, value] of search) {
    if (!key.startsWith(PARAM_PREFIX)) continue;
    params[key.slice(PARAM_PREFIX.length)] = value;
    clean.delete(key);
  }
  const segments = trimSlash(pathname).split("/").filter(Boolean);
  // trailingSlash is on in the mobile build; pages compare against slash-less paths.
  if (!segments.includes(PLACEHOLDER)) return { pathname: trimSlash(pathname), params, search: clean };

  for (const pattern of [...table().dynamic].sort(bySpecificity)) {
    const parts = pattern.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const ok = parts.every((p, i) => (p.startsWith("[") ? segments[i] === PLACEHOLDER : p === segments[i]));
    if (!ok) continue;
    const real = parts.map((p) => (p.startsWith("[") ? encodeURIComponent(params[p.slice(1, -1)] ?? "") : p));
    return { pathname: "/" + real.join("/"), params, search: clean };
  }
  return { pathname, params, search: clean };
}
