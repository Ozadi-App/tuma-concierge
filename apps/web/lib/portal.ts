"use client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";
const TOKEN_KEY = "peebee-portal-token";

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null): void {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private window */ }
}

export type PortalConfig = {
  enabled: boolean;
  accountCreation: "register_here" | "sign_in_only";
  phoneCodeRequired: boolean;
  features: string[];
  categories: Array<{ id: string; name: string }>;
  storeCategories: Array<{ id: string; name: string }>;
  webDomain: string;
};

export type PortalMe = {
  merchant: { id: string; displayName: string; legalName: string; status: string; kyc: string } | null;
  documents?: { registrationNumber: boolean; taxId: boolean; ownerId: boolean; businessRegistration: boolean };
  store: { id: string; name: string; slug: string; status: string; listedInApp: boolean; webStoreEnabled: boolean; url: string } | null;
  nextSteps: string[];
  offered?: string[];
};

export class PortalError extends Error {
  constructor(message: string, public code = "error", public status = 0) { super(message); }
}

export async function portalFetch<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; form?: FormData; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const token = init.auth === false ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
      method: init.method ?? "GET", headers, cache: "no-store",
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new PortalError("We couldn't reach Peebee. Check your connection and try again.", "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PortalError(data.message || (res.status === 401 ? "Please sign in again." : "Something went wrong. Please try again."), data.error || "error", res.status);
  return data as T;
}
