import { friendlyErrorMessage } from "@peebee/shared";
import { getStoredToken, TOKEN_KEY, USER_KEY } from "./api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

export class AdminRequestError extends Error {
  constructor(public status: number, message: string, public issues?: { path: (string | number)[]; message: string }[]) {
    super(message);
  }
}

/** A call to an admin endpoint that has no typed method on the shared client. Errors carry the server's message. */
export async function adminRequest<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/v1${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401 && token && typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; issues?: { path: (string | number)[]; message: string }[] };
  if (!res.ok) {
    const first = body.issues?.[0];
    throw new AdminRequestError(res.status, first ? `${first.path.join(".") || "Value"}: ${first.message}` : (body.message ?? body.error ?? res.statusText), body.issues);
  }
  return body as T;
}

export function requestErrorMessage(err: unknown): string {
  return err instanceof AdminRequestError ? err.message : friendlyErrorMessage(err);
}
