import { isSocialVideoPage, parsePublicHttpsUrl } from "../url-guard.js";
import { VideoProviderError, type VideoAdapter } from "../types.js";

const P = "link";
const HLS_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl", "text/plain", "application/octet-stream"];

function kindOf(url: URL): "hls" | "mp4" | null {
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "mp4";
  return null;
}

/**
 * A plain https address to a video file or HLS playlist the creator hosts anywhere. Peebee plays it
 * in its own player; it cannot lock it, because anyone with the address can fetch it.
 */
export const linkAdapter: VideoAdapter = {
  key: P,
  displayName: "Video link",
  summary: "Paste the address of a video file (.mp4, .webm) or an HLS playlist (.m3u8) you host yourself.",
  credentialFields: [],
  supportsDirectUpload: false,
  supportsImport: true,
  supportsSignedPlayback: () => false,

  async verifyCredentials() {},

  async createUpload() {
    throw new VideoProviderError(P, "unsupported", "Links cannot be uploaded to. Paste the video's address instead.");
  },

  async importAsset(_creds, reference) {
    const url = parsePublicHttpsUrl(reference);
    if (!url) throw new VideoProviderError(P, "invalid_reference", "Use a public https address.");
    if (isSocialVideoPage(url)) {
      throw new VideoProviderError(P, "invalid_reference", "Pages from YouTube, TikTok and similar sites cannot be added. Use a link to the video file itself.");
    }
    const kind = kindOf(url);
    if (!kind) throw new VideoProviderError(P, "invalid_reference", "The address must end in .mp4, .webm, .mov or .m3u8.");

    // Check it is really there: HEAD, no redirects (a redirect could point anywhere), short timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    } catch {
      throw new VideoProviderError(P, "unavailable", "That address could not be reached.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new VideoProviderError(P, "invalid_reference", "That address did not return a video.");
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const looksRight = kind === "hls" ? HLS_TYPES.includes(type) : type.startsWith("video/") || type === "application/octet-stream";
    if (!looksRight) throw new VideoProviderError(P, "invalid_reference", "That address is not a video file.");

    const normalised = url.toString();
    return { externalId: normalised, status: "ready", ...(kind === "hls" ? { hlsUrl: normalised } : { mp4Url: normalised }) };
  },

  async getAsset(_creds, externalId) {
    // Nothing is stored on a provider; the address is the video.
    const url = parsePublicHttpsUrl(externalId);
    if (!url) return { externalId, status: "failed", error: "The address is no longer valid." };
    return { externalId, status: "ready", ...(kindOf(url) === "hls" ? { hlsUrl: externalId } : { mp4Url: externalId }) };
  },

  async playback(_creds, asset) {
    return { hlsUrl: asset.hlsUrl ?? undefined, mp4Url: asset.mp4Url ?? undefined, posterUrl: asset.posterUrl ?? undefined };
  },

  async deleteAsset() {},
};
