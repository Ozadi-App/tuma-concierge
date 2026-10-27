import { providerJson, need } from "../http.js";
import { VideoProviderError, type VideoAdapter, type VideoCredentials } from "../types.js";

const P = "livepeer";
const BASE = "https://livepeer.studio/api";
const INGEST = "https://playback.livepeer.studio/webrtc";
const auth = (creds: VideoCredentials) => ({ Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json" });
const unsupported = () => new VideoProviderError(P, "unsupported", "Livepeer is used for going live only. Upload videos with another provider.");

type LpStream = { id?: string; streamKey?: string; playbackId?: string };

/**
 * The address a phone sends its camera to. Livepeer answers the base address with the nearest region's address;
 * if that lookup fails the base address itself still works (it redirects).
 */
async function ingestUrl(streamKey: string): Promise<string> {
  const base = `${INGEST}/${encodeURIComponent(streamKey)}`;
  try {
    const res = await fetch(base, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5_000) });
    const next = res.headers.get("location");
    if (next && /^https:\/\/[a-z0-9.-]+\.livepeer\.(studio|com)\//i.test(next)) return next;
  } catch {
    /* use the base address */
  }
  return base;
}

/**
 * Livepeer Studio: live streaming only. It has a free start, takes a phone camera over WebRTC (WHIP) and plays back as
 * HLS. Videos, uploads and locked playback are left to the other providers.
 */
export const livepeerAdapter: VideoAdapter = {
  key: P,
  displayName: "Livepeer Studio",
  summary: "Going live from a phone, with a free start. Live only: upload videos with another provider.",
  credentialFields: [{ key: "apiKey", label: "API key", secret: true, required: true, envVar: "LIVEPEER_API_KEY", helpText: "Livepeer Studio dashboard → Developers → API keys. A key with access to streams." }],
  supportsDirectUpload: false,
  supportsImport: false,
  supportsSignedPlayback: () => false,

  async verifyCredentials(creds) {
    need(P, creds, "apiKey");
    await providerJson(P, `${BASE}/stream?streamsonly=1&limit=1`, { headers: auth(creds) });
  },

  async createUpload() { throw unsupported(); },
  async importAsset() { throw unsupported(); },
  async getAsset() { throw unsupported(); },
  async playback(_creds, asset) { return { hlsUrl: asset.hlsUrl ?? undefined, posterUrl: asset.posterUrl ?? undefined }; },
  async deleteAsset() { /* nothing is stored as a video */ },

  // Recording is off, so nothing is kept after the stream. The stream key (the secret half of the address) is only
  // ever in publishUrl, which goes to the host alone.
  supportsLive: true,

  async createLiveInput(creds, input) {
    need(P, creds, "apiKey");
    const s = await providerJson<LpStream>(P, `${BASE}/stream`, {
      method: "POST",
      headers: auth(creds),
      body: JSON.stringify({ name: (input.title || "Peebee live").slice(0, 120), record: false }),
    });
    if (!s?.id || !s.streamKey || !s.playbackId) throw new VideoProviderError(P, "unavailable", "The video provider could not start a live stream.");
    return { externalId: s.id, publishUrl: await ingestUrl(s.streamKey), hlsUrl: `https://livepeercdn.studio/hls/${s.playbackId}/index.m3u8` };
  },

  async endLiveInput(creds, externalId) {
    need(P, creds, "apiKey");
    await providerJson(P, `${BASE}/stream/${encodeURIComponent(externalId)}`, { method: "DELETE", headers: auth(creds), allow404: true });
  },
};
