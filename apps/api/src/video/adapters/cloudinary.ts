import { createHash, randomBytes } from "node:crypto";
import { basicAuth, providerJson, need } from "../http.js";
import { VideoProviderError, type AssetInfo, type VideoAdapter, type VideoCredentials } from "../types.js";

const P = "cloudinary";
const api = (creds: VideoCredentials, path: string) => `https://api.cloudinary.com/v1_1/${encodeURIComponent(creds.cloudName ?? "")}${path}`;
const auth = (creds: VideoCredentials) => ({ Authorization: basicAuth(creds.apiKey ?? "", creds.apiSecret ?? "") });

/** Cloudinary's request signature: the sorted `key=value` pairs joined with &, then the secret, SHA-1. */
export function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== "" && !["file", "cloud_name", "resource_type", "api_key"].includes(k))
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

const encodePath = (publicId: string) => publicId.split("/").map(encodeURIComponent).join("/");

type CloudinaryResource = { public_id: string; duration?: number; width?: number; height?: number };

function urlsFor(creds: VideoCredentials, publicId: string) {
  const base = `https://res.cloudinary.com/${encodeURIComponent(creds.cloudName ?? "")}/video/upload`;
  const id = encodePath(publicId);
  return {
    hlsUrl: `${base}/sp_auto/${id}.m3u8`,
    mp4Url: `${base}/f_mp4,q_auto/${id}.mp4`,
    posterUrl: `${base}/so_0,f_jpg/${id}.jpg`,
  };
}

export const cloudinaryAdapter: VideoAdapter = {
  key: P,
  displayName: "Cloudinary",
  summary: "Bring a Cloudinary account: videos you already host there, or new uploads sent straight to it. Public delivery.",
  credentialFields: [
    { key: "cloudName", label: "Cloud name", secret: false, required: true, envVar: "CLOUDINARY_CLOUD_NAME", helpText: "Shown at the top of your Cloudinary dashboard." },
    { key: "apiKey", label: "API key", secret: false, required: true, envVar: "CLOUDINARY_API_KEY" },
    { key: "apiSecret", label: "API secret", secret: true, required: true, envVar: "CLOUDINARY_API_SECRET" },
  ],
  supportsDirectUpload: true,
  supportsImport: true,
  supportsSignedPlayback: () => false,

  async verifyCredentials(creds) {
    need(P, creds, "cloudName", "apiKey", "apiSecret");
    await providerJson(P, api(creds, "/ping"), { headers: auth(creds) });
  },

  async createUpload(creds, input) {
    need(P, creds, "cloudName", "apiKey", "apiSecret");
    if (input.protectedPlayback) throw new VideoProviderError(P, "unsupported", "Cloudinary videos can only be public for now. Choose another provider for locked videos.");
    const publicId = `peebee/${randomBytes(9).toString("hex")}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params = { public_id: publicId, timestamp };
    return {
      externalId: publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(creds.cloudName!)}/video/upload`,
      method: "POST",
      protocol: "form",
      fields: { ...params, api_key: creds.apiKey!, signature: cloudinarySignature(params, creds.apiSecret!) },
      expiresAt: new Date((Number(timestamp) + 3600) * 1000).toISOString(),
    };
  },

  async importAsset(creds, reference) {
    need(P, creds, "cloudName", "apiKey", "apiSecret");
    const publicId = reference.trim().replace(/\.(mp4|mov|m3u8|webm)$/i, "");
    if (!publicId || publicId.length > 255 || /[\s?#&]/.test(publicId)) {
      throw new VideoProviderError(P, "invalid_reference", "Enter the video's public ID from Cloudinary (for example folder/my-video).");
    }
    const found = await fetchResource(creds, publicId);
    if (!found) throw new VideoProviderError(P, "invalid_reference", "That video could not be found in the provider account.");
    return toAsset(creds, found);
  },

  async getAsset(creds, externalId) {
    need(P, creds, "cloudName", "apiKey", "apiSecret");
    const found = await fetchResource(creds, externalId);
    // Until the upload lands there is nothing to find yet.
    return found ? toAsset(creds, found) : { externalId, status: "uploading" };
  },

  async playback(_creds, asset) {
    return { hlsUrl: asset.hlsUrl ?? undefined, mp4Url: asset.mp4Url ?? undefined, posterUrl: asset.posterUrl ?? undefined };
  },

  async deleteAsset(creds, externalId) {
    need(P, creds, "cloudName", "apiKey", "apiSecret");
    await providerJson(P, api(creds, `/resources/video/upload?public_ids[]=${encodeURIComponent(externalId)}`), { method: "DELETE", headers: auth(creds), allow404: true });
  },
};

async function fetchResource(creds: VideoCredentials, publicId: string): Promise<CloudinaryResource | null> {
  return providerJson<CloudinaryResource>(P, api(creds, `/resources/video/upload/${encodePath(publicId)}`), { headers: auth(creds), allow404: true });
}

function toAsset(creds: VideoCredentials, r: CloudinaryResource): AssetInfo {
  return { externalId: r.public_id, status: "ready", durationSeconds: r.duration && r.duration > 0 ? r.duration : undefined, width: r.width, height: r.height, ...urlsFor(creds, r.public_id) };
}
