import { randomBytes } from "node:crypto";
import type { VideoAdapter } from "../types.js";

const SAMPLE = "https://app.peebee.online/demo-video/market";

/** A stand-in provider for sandbox and tests: "uploads" finish after a couple of seconds. */
export const mockAdapter: VideoAdapter = {
  key: "mock",
  displayName: "Demo provider",
  summary: "Simulated videos for testing. Uses Peebee's sample clips.",
  credentialFields: [],
  supportsDirectUpload: true,
  supportsImport: true,
  supportsSignedPlayback: () => true,

  async verifyCredentials() {},

  async createUpload() {
    return {
      externalId: `mock_${Date.now()}_${randomBytes(4).toString("hex")}`,
      uploadUrl: "https://app.peebee.online/demo-video/upload",
      method: "POST",
      protocol: "form",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
  },

  async importAsset(creds, reference) {
    return this.getAsset(creds, reference.trim() || `mock_${Date.now()}`);
  },

  async getAsset(_creds, externalId) {
    const made = Number(externalId.split("_")[1]);
    const done = !Number.isFinite(made) || Date.now() - made > 2000;
    return done
      ? { externalId, status: "ready", durationSeconds: 30, width: 720, height: 1280, hlsUrl: undefined, mp4Url: `${SAMPLE}.mp4`, posterUrl: `${SAMPLE}.jpg` }
      : { externalId, status: "processing" };
  },

  async playback(_creds, asset, opts) {
    return { mp4Url: asset.mp4Url ?? `${SAMPLE}.mp4`, posterUrl: asset.posterUrl ?? `${SAMPLE}.jpg`, expiresAt: opts.signed ? new Date(Date.now() + opts.ttlSeconds * 1000).toISOString() : undefined };
  },

  async deleteAsset() {},

  // Sandbox and tests: the app skips the camera connection when it sees this address.
  supportsLive: true,
  async createLiveInput() {
    const id = `mock_live_${Date.now()}_${randomBytes(3).toString("hex")}`;
    return { externalId: id, publishUrl: "https://mock.invalid/whip", hlsUrl: `${SAMPLE}.m3u8`, posterUrl: `${SAMPLE}.jpg` };
  },
  async endLiveInput() {},
};
