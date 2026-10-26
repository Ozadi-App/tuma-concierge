import { providerJson, need } from "../http.js";
import { VideoProviderError, type AssetInfo, type VideoAdapter, type VideoCredentials } from "../types.js";

const P = "cloudflare_stream";
const api = (creds: VideoCredentials, path: string) => `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(creds.accountId ?? "")}/stream${path}`;
const auth = (creds: VideoCredentials) => ({ Authorization: `Bearer ${creds.apiToken}`, "Content-Type": "application/json" });

type CfVideo = {
  uid: string;
  readyToStream?: boolean;
  status?: { state?: string; errorReasonText?: string };
  duration?: number;
  thumbnail?: string;
  playback?: { hls?: string };
  input?: { width?: number; height?: number };
};
type CfEnvelope<T> = { success?: boolean; result?: T };

function toAsset(v: CfVideo): AssetInfo {
  const state = v.status?.state;
  const status = v.readyToStream || state === "ready" ? "ready" : state === "error" ? "failed" : state === "pendingupload" ? "uploading" : "processing";
  return {
    externalId: v.uid,
    status,
    durationSeconds: v.duration && v.duration > 0 ? v.duration : undefined,
    width: v.input?.width && v.input.width > 0 ? v.input.width : undefined,
    height: v.input?.height && v.input.height > 0 ? v.input.height : undefined,
    posterUrl: v.thumbnail,
    hlsUrl: v.playback?.hls,
    error: status === "failed" ? (v.status?.errorReasonText ?? "The video could not be processed.") : undefined,
  };
}

export const cloudflareStreamAdapter: VideoAdapter = {
  key: P,
  displayName: "Cloudflare Stream",
  summary: "Uploads, encoding and delivery in one price. Fits Peebee's Cloudflare hosting and can lock videos behind signed addresses.",
  credentialFields: [
    { key: "accountId", label: "Account ID", secret: false, required: true, envVar: "CLOUDFLARE_STREAM_ACCOUNT_ID", helpText: "Cloudflare dashboard → Stream, or the account's overview page." },
    { key: "apiToken", label: "API token", secret: true, required: true, envVar: "CLOUDFLARE_STREAM_API_TOKEN", helpText: "A token with the Stream: Edit permission." },
  ],
  supportsDirectUpload: true,
  supportsImport: true,
  supportsSignedPlayback: () => true,

  async verifyCredentials(creds) {
    need(P, creds, "accountId", "apiToken");
    await providerJson(P, `${api(creds, "")}?per_page=1`, { headers: auth(creds) });
  },

  async createUpload(creds, input) {
    need(P, creds, "accountId", "apiToken");
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const body = {
      maxDurationSeconds: input.maxDurationSeconds,
      requireSignedURLs: input.protectedPlayback,
      expiry,
      meta: input.title ? { name: input.title.slice(0, 120) } : undefined,
    };
    const res = await providerJson<CfEnvelope<{ uploadURL: string; uid: string }>>(P, api(creds, "/direct_upload"), {
      method: "POST",
      headers: auth(creds),
      body: JSON.stringify(body),
    });
    const r = res?.result;
    if (!r?.uploadURL || !r.uid) throw new VideoProviderError(P, "unavailable", "The video provider did not return an upload address.");
    return { externalId: r.uid, uploadUrl: r.uploadURL, method: "POST", protocol: "form", expiresAt: expiry };
  },

  async importAsset(creds, reference) {
    need(P, creds, "accountId", "apiToken");
    if (!/^[a-f0-9]{32}$/i.test(reference.trim())) {
      throw new VideoProviderError(P, "invalid_reference", "That does not look like a Cloudflare Stream video ID (32 letters and numbers).");
    }
    return this.getAsset(creds, reference.trim());
  },

  async getAsset(creds, externalId) {
    need(P, creds, "accountId", "apiToken");
    const res = await providerJson<CfEnvelope<CfVideo>>(P, api(creds, `/${encodeURIComponent(externalId)}`), { headers: auth(creds) });
    if (!res?.result) throw new VideoProviderError(P, "invalid_reference", "That video could not be found in the provider account.");
    return toAsset(res.result);
  },

  async playback(creds, asset, opts) {
    if (!opts.signed) return { hlsUrl: asset.hlsUrl ?? undefined, posterUrl: asset.posterUrl ?? undefined };
    need(P, creds, "accountId", "apiToken");
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    const res = await providerJson<CfEnvelope<{ token: string }>>(P, api(creds, `/${encodeURIComponent(asset.externalId)}/token`), {
      method: "POST",
      headers: auth(creds),
      body: JSON.stringify({ exp }),
    });
    const token = res?.result?.token;
    if (!token) throw new VideoProviderError(P, "unavailable", "Could not prepare this video for playback.");
    // A signed address is the unsigned one with the video id swapped for the token.
    const swap = (url?: string | null) => (url ? url.replace(asset.externalId, token) : undefined);
    return { hlsUrl: swap(asset.hlsUrl), posterUrl: swap(asset.posterUrl), expiresAt: new Date(exp * 1000).toISOString() };
  },

  // Going live from a phone: Cloudflare gives each live input a WebRTC (WHIP) address the browser sends to, and
  // the same id plays back as HLS. Recording is off, so nothing is kept (and billed for storage) after the stream.
  supportsLive: true,

  async createLiveInput(creds, input) {
    need(P, creds, "accountId", "apiToken");
    const res = await providerJson<CfEnvelope<{ uid: string; webRTC?: { url?: string } }>>(P, api(creds, "/live_inputs"), {
      method: "POST",
      headers: auth(creds),
      body: JSON.stringify({ meta: { name: (input.title || "Peebee live").slice(0, 120) }, recording: { mode: "off" } }),
    });
    const r = res?.result;
    if (!r?.uid || !r.webRTC?.url) throw new VideoProviderError(P, "unavailable", "The video provider could not start a live stream. Check that live streaming is turned on for the account.");
    return { externalId: r.uid, publishUrl: r.webRTC.url, hlsUrl: `https://videodelivery.net/${r.uid}/manifest/video.m3u8`, posterUrl: `https://videodelivery.net/${r.uid}/thumbnails/thumbnail.jpg` };
  },

  async endLiveInput(creds, externalId) {
    need(P, creds, "accountId", "apiToken");
    await providerJson(P, api(creds, `/live_inputs/${encodeURIComponent(externalId)}`), { method: "DELETE", headers: auth(creds), allow404: true });
  },

  async deleteAsset(creds, externalId) {
    need(P, creds, "accountId", "apiToken");
    await providerJson(P, api(creds, `/${encodeURIComponent(externalId)}`), { method: "DELETE", headers: auth(creds), allow404: true });
  },
};
