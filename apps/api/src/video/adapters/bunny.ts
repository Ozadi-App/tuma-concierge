import { createHash } from "node:crypto";
import { providerJson, need } from "../http.js";
import { VideoProviderError, type AssetInfo, type VideoAdapter, type VideoCredentials } from "../types.js";

const P = "bunny";
const lib = (creds: VideoCredentials, path = "") => `https://video.bunnycdn.com/library/${encodeURIComponent(creds.libraryId ?? "")}/videos${path}`;
const headers = (creds: VideoCredentials) => ({ AccessKey: creds.apiKey ?? "", "Content-Type": "application/json", Accept: "application/json" });

/** The signature Bunny's resumable (TUS) upload endpoint expects: sha256(library + key + expiry + video). */
export function bunnyUploadSignature(libraryId: string, apiKey: string, expire: number, videoId: string): string {
  return createHash("sha256").update(`${libraryId}${apiKey}${expire}${videoId}`).digest("hex");
}

type BunnyVideo = { guid: string; status?: number; length?: number; width?: number; height?: number; thumbnailFileName?: string };

function host(creds: VideoCredentials): string {
  return (creds.pullZoneHost ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function toAsset(creds: VideoCredentials, v: BunnyVideo): AssetInfo {
  // Bunny: 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed, 7 captions.
  const s = v.status ?? 0;
  const status = s === 4 || s === 7 ? "ready" : s === 5 || s === 6 ? "failed" : s === 0 ? "uploading" : "processing";
  const h = host(creds);
  return {
    externalId: v.guid,
    status,
    durationSeconds: v.length && v.length > 0 ? v.length : undefined,
    width: v.width || undefined,
    height: v.height || undefined,
    hlsUrl: h ? `https://${h}/${v.guid}/playlist.m3u8` : undefined,
    posterUrl: h ? `https://${h}/${v.guid}/${v.thumbnailFileName ?? "thumbnail.jpg"}` : undefined,
    error: status === "failed" ? "The video could not be processed." : undefined,
  };
}

export const bunnyAdapter: VideoAdapter = {
  key: P,
  displayName: "Bunny Stream",
  summary: "Low-cost storage and delivery, billed by data used. Public playback for now.",
  credentialFields: [
    { key: "libraryId", label: "Library ID", secret: false, required: true, envVar: "BUNNY_STREAM_LIBRARY_ID", helpText: "Bunny dashboard → Stream → your library." },
    { key: "apiKey", label: "Library API key", secret: true, required: true, envVar: "BUNNY_STREAM_API_KEY" },
    { key: "pullZoneHost", label: "CDN hostname", secret: false, required: true, placeholder: "vz-xxxxxxxx-xxx.b-cdn.net", envVar: "BUNNY_STREAM_CDN_HOST", helpText: "The library's CDN hostname, shown under Delivery." },
  ],
  supportsDirectUpload: true,
  supportsImport: true,
  supportsSignedPlayback: () => false,

  async verifyCredentials(creds) {
    need(P, creds, "libraryId", "apiKey");
    await providerJson(P, `${lib(creds)}?page=1&itemsPerPage=1`, { headers: headers(creds) });
  },

  async createUpload(creds, input) {
    need(P, creds, "libraryId", "apiKey", "pullZoneHost");
    if (input.protectedPlayback) throw new VideoProviderError(P, "unsupported", "Bunny videos can only be public for now. Choose another provider for locked videos.");
    const created = await providerJson<{ guid?: string }>(P, lib(creds), { method: "POST", headers: headers(creds), body: JSON.stringify({ title: (input.title ?? "Peebee upload").slice(0, 120) }) });
    if (!created?.guid) throw new VideoProviderError(P, "unavailable", "The video provider did not return an upload address.");
    const expire = Math.floor(Date.now() / 1000) + 3600;
    return {
      externalId: created.guid,
      uploadUrl: "https://video.bunnycdn.com/tusupload",
      method: "POST",
      protocol: "tus",
      headers: {
        AuthorizationSignature: bunnyUploadSignature(creds.libraryId!, creds.apiKey!, expire, created.guid),
        AuthorizationExpire: String(expire),
        VideoId: created.guid,
        LibraryId: creds.libraryId!,
      },
      expiresAt: new Date(expire * 1000).toISOString(),
    };
  },

  async importAsset(creds, reference) {
    need(P, creds, "libraryId", "apiKey", "pullZoneHost");
    if (!/^[0-9a-f-]{36}$/i.test(reference.trim())) {
      throw new VideoProviderError(P, "invalid_reference", "That does not look like a Bunny video ID (a 36-character GUID).");
    }
    return this.getAsset(creds, reference.trim());
  },

  async getAsset(creds, externalId) {
    need(P, creds, "libraryId", "apiKey");
    const v = await providerJson<BunnyVideo>(P, lib(creds, `/${encodeURIComponent(externalId)}`), { headers: headers(creds) });
    if (!v?.guid) throw new VideoProviderError(P, "invalid_reference", "That video could not be found in the provider account.");
    return toAsset(creds, v);
  },

  async playback(_creds, asset) {
    return { hlsUrl: asset.hlsUrl ?? undefined, posterUrl: asset.posterUrl ?? undefined };
  },

  async deleteAsset(creds, externalId) {
    need(P, creds, "libraryId", "apiKey");
    await providerJson(P, lib(creds, `/${encodeURIComponent(externalId)}`), { method: "DELETE", headers: headers(creds), allow404: true });
  },
};
