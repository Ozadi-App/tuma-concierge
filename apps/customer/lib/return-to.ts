/** Where to go after signing in, when a shared link brought someone to the login screen. */
const KEY = "peebee_return_to";

export function rememberReturnTo(path: string) {
  try {
    if (path.startsWith("/") && !path.startsWith("//")) sessionStorage.setItem(KEY, path);
  } catch {}
}

/** The remembered page, once; only paths on this site. */
export function takeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}
