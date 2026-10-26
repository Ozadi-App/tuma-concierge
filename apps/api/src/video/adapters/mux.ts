import { basicAuth, providerJson, need } from "../http.js";
import { VideoProviderError, type AssetInfo, type VideoAdapter, type VideoCredentials } from "../types.js";

const P = "mux";
const BASE = "https://api.mux.com/video/v1";
const headers = (creds: VideoCredentials) => ({ Authorization: basicAuth(creds.tokenId ?? "", creds.tokenSecret ?? ""), "Content-Type": "application/json" });

type MuxAsset = {
  id: string;
  status?: "preparing" | "ready" | "errored";
  duration?: number;
  max_stored_resolution?: string;
  playback_ids?: Array<{ id: string; policy: string }>;
  errors?: { messages?: string[] };
};

const UPLOAD_PREFIX = "upload:";

function toAsset(a: MuxAsset): AssetInfo {
  const publicId = a.playback_ids?.find((p) => p.policy === "public")?.id;
  const status = a.status === "ready" ? "ready" : a.status === "errored" ? "failed" : "processing";
  return {
    externalId: a.id,
    status,
    durationSeconds: a.duration && a.duration > 0 ? a.duration : undefined,
    posterUrl: publicId ? `https://image.mux.com/${publicId}/thumbnail.jpg` : undefined,
    hlsUrl: publicId ? `https://stream.mux.com/${publicId}.m3u8` : undefined,
    error: status === "failed" ? (a.errors?.messages?.[0] ?? "The video could not be processed.") : undefined,
  };
}

export const muxAdapter: VideoAdapter = {
  key: P,
  displayName: "Mux",
  summary: "Developer-friendly video API with strong analytics. Public playback only for now.",
  credentialFields: [
    { key: "tokenId", label: "Access token ID", secret: false, required: true, envVar: "MUX_TOKEN_ID", helpText: "Mux dashboard → Settings → API Access Tokens (Mux Video: read and write)." },
    { key: "tokenSecret", label: "Access token secret", secret: true, required: true, envVar: "MUX_TOKEN_SECRET" },
  ],
  supportsDirectUpload: true,
  supportsImport: true,
  // Signed Mux playback needs a signing key and JWTs; until that is built, protected videos need another provider.
  supportsSignedPlayback: () => false,

  async verifyCredentials(creds) {
    need(P, creds, "tokenId", "tokenSecret");
    await providerJson(P, `${BASE}/assets?limit=1`, { headers: headers(creds) });
  },

  async createUpload(creds, input) {
    need(P, creds, "tokenId", "tokenSecret");
    if (input.protectedPlayback) throw new VideoProviderError(P, "unsupported", "Mux videos can only be public for now. Choose another provider for locked videos.");
    const res = await providerJson<{ data?: { id: string; url: string } }>(P, `${BASE}/uploads`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify({ cors_origin: "*", timeout: 3600, new_asset_settings: { playback_policy: ["public"], passthrough: input.title?.slice(0, 250) } }),
    });
    const d = res?.data;
    if (!d?.id || !d.url) throw new VideoProviderError(P, "unavailable", "The video provider did not return an upload address.");
    // The asset id only exists once the upload starts, so the upload id stands in until getAsset resolves it.
    return { externalId: `${UPLOAD_PREFIX}${d.id}`, uploadUrl: d.url, method: "PUT", protocol: "raw", expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  },

  async importAsset(creds, reference) {
    need(P, creds, "tokenId", "tokenSecret");
    const info = await this.getAsset(creds, reference.trim());
    if (!info.hlsUrl) {
      throw new VideoProviderError(P, "invalid_reference", "This Mux asset has no public playback ID. Add a public playback ID to it in Mux, then try again.");
    }
    return info;
  },

  async getAsset(creds, externalId) {
    need(P, creds, "tokenId", "tokenSecret");
    let assetId = externalId;
    if (externalId.startsWith(UPLOAD_PREFIX)) {
      const up = await providerJson<{ data?: { asset_id?: string; status?: string } }>(P, `${BASE}/uploads/${encodeURIComponent(externalId.slice(UPLOAD_PREFIX.length))}`, { headers: headers(creds) });
      if (up?.data?.status === "errored" || up?.data?.status === "cancelled" || up?.data?.status === "timed_out") {
        return { externalId, status: "failed", error: "The upload did not finish." };
      }
      if (!up?.data?.asset_id) return { externalId, status: "uploading" };
      assetId = up.data.asset_id;
    }
    const res = await providerJson<{ data?: MuxAsset }>(P, `${BASE}/assets/${encodeURIComponent(assetId)}`, { headers: headers(creds) });
    if (!res?.data) throw new VideoProviderError(P, "invalid_reference", "That video could not be found in the provider account.");
    return toAsset(res.data);
  },

  async playback(_creds, asset) {
    return { hlsUrl: asset.hlsUrl ?? undefined, posterUrl: asset.posterUrl ?? undefined };
  },

  async deleteAsset(creds, externalId) {
    need(P, creds, "tokenId", "tokenSecret");
    if (externalId.startsWith(UPLOAD_PREFIX)) return;
    await providerJson(P, `${BASE}/assets/${encodeURIComponent(externalId)}`, { method: "DELETE", headers: headers(creds), allow404: true });
  },
};
