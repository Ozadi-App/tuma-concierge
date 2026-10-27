import { VideoProviderError } from "./types.js";

const TIMEOUT_MS = 12_000;

/**
 * One call to a provider's API. Failures become a VideoProviderError whose client message is safe to
 * show a creator; the upstream body only goes to the logs, because provider errors can echo account
 * details back.
 */
export async function providerJson<T = Record<string, unknown>>(
  provider: string,
  url: string,
  init: RequestInit & { allow404?: boolean } = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
  } catch (err) {
    console.error(`${provider} request failed:`, err);
    throw new VideoProviderError(provider, "unavailable", "The video provider could not be reached. Please try again.", err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : undefined);
  } finally {
    clearTimeout(timer);
  }
  // Cloudflare Workers do not implement redirect: "error", so redirects are never followed (a provider call must not
  // be sent somewhere else with the keys) and are refused here instead.
  if (res.status >= 300 && res.status < 400) {
    console.error(`${provider} redirected (${res.status}) to ${res.headers.get("location") ?? "?"}`);
    throw new VideoProviderError(provider, "rejected", "The video provider answered from an unexpected address.");
  }
  if (res.status === 404 && init.allow404) return null;
  if (!res.ok) {
    const upstream = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`${provider} responded ${res.status}: ${upstream}`);
    if (res.status === 401 || res.status === 403) {
      throw new VideoProviderError(provider, "auth_failed", "The video provider refused these credentials. Check the keys and their permissions.", upstream);
    }
    if (res.status === 404) {
      throw new VideoProviderError(provider, "invalid_reference", "That video could not be found in the provider account.", upstream);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new VideoProviderError(provider, "unavailable", "The video provider is busy right now. Please try again shortly.", upstream);
    }
    throw new VideoProviderError(provider, "rejected", "The video provider rejected the request.", upstream);
  }
  if (res.status === 204) return {} as T;
  return (await res.json().catch(() => ({}))) as T;
}

export function basicAuth(user: string, secret: string): string {
  return `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;
}

export function need(provider: string, creds: Record<string, string>, ...fields: string[]): void {
  const missing = fields.filter((f) => !creds[f]);
  if (missing.length) {
    throw new VideoProviderError(provider, "not_configured", "This video provider is not set up yet.");
  }
}
