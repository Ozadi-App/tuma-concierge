import type { ScreenState } from "@peebee/shared";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");
export const SECRET_KEY = "peebee_tv_secret";

export class TvAuthError extends Error {
  constructor() {
    super("This screen isn't registered.");
  }
}

async function call<T>(path: string, secret: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Device ${secret}` } : {}) },
    cache: "no-store",
  });
  if (res.status === 401) throw new TvAuthError();
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
  return body;
}

export type PairStart = { deviceId: string; secret: string; code: string; expiresInSeconds: number; pollSeconds: number };
export type Me =
  | { status: "unpaired"; code: string | null; expiresInSeconds: number; pollSeconds: number }
  | { status: "paired"; name: string; ownerName: string; pollSeconds: number };

export const tvApi = {
  start: () => call<PairStart>("/v1/tv/pair/start", null, { method: "POST", body: "{}" }),
  me: (secret: string) => call<Me>("/v1/tv/me", secret),
  screen: (secret: string) => call<ScreenState>("/v1/tv/screen/state", secret),
  unpair: (secret: string) => call<{ ok: true }>("/v1/tv/me", secret, { method: "DELETE" }),
};
