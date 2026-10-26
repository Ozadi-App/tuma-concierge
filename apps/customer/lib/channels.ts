"use client";

import type { ChannelsPublicConfig } from "@peebee/shared";
import { useEffect, useState } from "react";
import { api, getStoredToken } from "./api";
import { compressImage } from "./image-compress";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** "5m", "3h", "2d" — how long ago, kept short for cards. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(`${iso.replace(" ", "T")}${/Z|[+-]\d\d:?\d\d$/.test(iso) ? "" : "Z"}`).getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d`;
  return new Date(t).toLocaleDateString();
}

export const compactNumber = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

let cached: ChannelsPublicConfig | null = null;
let inflight: Promise<ChannelsPublicConfig> | null = null;

/** The current Channels rules, fetched once and shared. `enabled` is false until an admin turns Channels on. */
export function useChannelsConfig(): { config: ChannelsPublicConfig | null; loading: boolean } {
  const [config, setConfig] = useState<ChannelsPublicConfig | null>(cached);
  const [loading, setLoading] = useState(!cached);
  useEffect(() => {
    if (cached) return;
    inflight ??= api.channelsConfig().then((c) => (cached = c)).catch(() => (cached = { enabled: false })).finally(() => { inflight = null; });
    void inflight.then((c) => { setConfig(c); setLoading(false); });
  }, []);
  return { config, loading };
}

/** Ad beacons are fire-and-forget: a failed one must never interrupt playback. */
export function adBeacon(token: string, event: string): void {
  try {
    void fetch(`${API_BASE}/v1/ads/e/${token}/${event}`, { method: "POST", keepalive: true }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
export const adClickUrl = (token: string) => `${API_BASE}/v1/ads/click/${token}`;

/** Uploads a picture (shrunk first) to Peebee's public media and returns the path to store. */
export async function uploadPicture(file: File): Promise<{ path: string; url: string }> {
  const small = await compressImage(file).catch(() => file);
  const form = new FormData();
  form.set("file", small);
  const res = await fetch(`${API_BASE}/v1/channels/media`, { method: "POST", headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` }, body: form });
  const body = (await res.json().catch(() => ({}))) as { path?: string; url?: string; message?: string };
  if (!res.ok || !body.path) throw new Error(body.message ?? "That picture could not be uploaded.");
  return { path: body.path, url: body.url ?? `${API_BASE}${body.path}` };
}

export async function uploadAudio(file: File): Promise<{ path: string; url: string }> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch(`${API_BASE}/v1/channels/media`, { method: "POST", headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` }, body: form });
  const body = (await res.json().catch(() => ({}))) as { path?: string; url?: string; message?: string };
  if (!res.ok || !body.path) throw new Error(body.message ?? "That audio could not be uploaded.");
  return { path: body.path, url: body.url ?? `${API_BASE}${body.path}` };
}

/** Share a link with the native sheet where there is one, otherwise copy it. */
export async function shareLink(title: string, path: string): Promise<"shared" | "copied" | "failed"> {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** One ID photo or selfie, sent privately. Only staff reviewing the check can ever see it. */
export async function uploadKycDocument(file: File): Promise<string> {
  const small = await compressImage(file, { maxDimension: 1800, quality: 0.85 }).catch(() => file);
  const form = new FormData();
  form.set("file", small);
  const res = await fetch(`${API_BASE}/v1/creator/kyc/documents`, { method: "POST", headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` }, body: form });
  const body = (await res.json().catch(() => ({}))) as { key?: string; message?: string };
  if (!res.ok || !body.key) throw new Error(body.message ?? "That photo could not be uploaded.");
  return body.key;
}
