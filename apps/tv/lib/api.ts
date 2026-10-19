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
export type TrialSlot = "a" | "b";
export type TrialClass = { slot: TrialSlot; code: string; title: string; hostName: string; stream: string | null };
export type Me =
  | { status: "unpaired"; code: string | null; expiresInSeconds: number; pollSeconds: number; trial: TrialSlot | null }
  | { status: "paired"; name: string; ownerName: string; pollSeconds: number; trial: TrialSlot | null };

export const tvApi = {
  start: () => call<PairStart>("/v1/tv/pair/start", null, { method: "POST", body: "{}" }),
  me: (secret: string) => call<Me>("/v1/tv/me", secret),
  screen: (secret: string) => call<ScreenState>("/v1/tv/screen/state", secret),
  /** The practice classes this screen can show. Public, so it works before the TV is paired. */
  trials: () => call<{ ok: true; classes: TrialClass[] }>("/v1/tv/trial", null),
  startTrial: (secret: string, slot: TrialSlot) => call<{ ok: true }>("/v1/tv/trial", secret, { method: "POST", body: JSON.stringify({ slot }) }),
  leaveTrial: (secret: string) => call<{ ok: true }>("/v1/tv/trial", secret, { method: "DELETE" }),
  unpair: (secret: string) => call<{ ok: true }>("/v1/tv/me", secret, { method: "DELETE" }),
};
