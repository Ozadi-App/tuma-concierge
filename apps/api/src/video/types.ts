/**
 * The contract every video provider adapter implements. Peebee only ever takes the *video* from a
 * provider — never its monetisation, ads or player. Playback always goes through Peebee's own
 * player, so Peebee alone decides what ads run (see ../ads).
 */

export const VIDEO_PROVIDERS = ["cloudflare_stream", "mux", "cloudinary", "bunny", "livepeer", "link", "mock"] as const;
export type VideoProviderKey = (typeof VIDEO_PROVIDERS)[number];

export type VideoSource = "platform" | "byo" | "link";
export type VideoStatus = "uploading" | "processing" | "ready" | "failed" | "deleted";

export type CredentialFieldDef = {
  key: string;
  label: string;
  /** Masked in the UI and never echoed back once set. */
  secret: boolean;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Env var the platform account falls back to when nothing is stored. */
  envVar?: string;
};

/** The saved credential fields of one provider account, already decrypted. */
export type VideoCredentials = Record<string, string>;

export type AssetInfo = {
  externalId: string;
  status: VideoStatus;
  durationSeconds?: number;
  width?: number;
  height?: number;
  posterUrl?: string;
  hlsUrl?: string;
  mp4Url?: string;
  error?: string;
};

export type UploadInstructions = {
  /** The provider's id for the video that will exist once the upload finishes. */
  externalId: string;
  /** Where the creator's device sends the file — straight to the provider, never through Peebee. */
  uploadUrl: string;
  method: "POST" | "PUT" | "PATCH";
  /** "tus" for resumable uploads, "form" for a multipart form post, "raw" for a plain body. */
  protocol: "tus" | "form" | "raw";
  headers?: Record<string, string>;
  /** Extra form fields for a "form" upload. The file goes in a field called `file`. */
  fields?: Record<string, string>;
  expiresAt: string;
};

export type PlaybackSources = {
  hlsUrl?: string;
  mp4Url?: string;
  posterUrl?: string;
  /** When signed addresses stop working. Absent for public addresses. */
  expiresAt?: string;
};

/** A live stream a phone camera can send to, and the playlist viewers watch. */
export type LiveInput = {
  /** The provider's id for the live input, kept so it can be switched off. */
  externalId: string;
  /** Where the host's camera sends to (WebRTC/WHIP). Private to the host. */
  publishUrl: string;
  /** What viewers play (HLS). */
  hlsUrl: string;
  posterUrl?: string;
};

export class VideoProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: "not_configured" | "auth_failed" | "rejected" | "unavailable" | "unsupported" | "invalid_reference",
    /** Safe to show the creator; upstream text stays in logs only. */
    readonly clientMessage: string,
    readonly upstreamMessage?: string,
  ) {
    super(`${provider}: ${code}`);
    this.name = "VideoProviderError";
  }
}

export interface VideoAdapter {
  key: VideoProviderKey;
  displayName: string;
  /** One line shown beside the provider when a creator or admin chooses. */
  summary: string;
  credentialFields: CredentialFieldDef[];
  /** Can a creator's device upload straight to the provider through createUpload. */
  supportsDirectUpload: boolean;
  /** Can an existing video be brought in by reference (an id, or a URL). */
  supportsImport: boolean;
  /** Whether videos can be locked so only people Peebee approves get an address that works. */
  supportsSignedPlayback(creds: VideoCredentials): boolean;
  /** Cheap live check that the saved credentials work. Throws VideoProviderError when they do not. */
  verifyCredentials(creds: VideoCredentials): Promise<void>;
  createUpload(creds: VideoCredentials, input: { maxDurationSeconds: number; title?: string; protectedPlayback: boolean }): Promise<UploadInstructions>;
  /** Looks up an existing video from whatever the creator pasted (an id, or a URL for "link"). */
  importAsset(creds: VideoCredentials, reference: string): Promise<AssetInfo>;
  getAsset(creds: VideoCredentials, externalId: string): Promise<AssetInfo>;
  playback(creds: VideoCredentials, asset: { externalId: string; hlsUrl?: string | null; mp4Url?: string | null; posterUrl?: string | null }, opts: { signed: boolean; ttlSeconds: number }): Promise<PlaybackSources>;
  deleteAsset(creds: VideoCredentials, externalId: string): Promise<void>;
  /** Providers that can take a live stream from a phone's camera (WebRTC). Optional. */
  supportsLive?: boolean;
  createLiveInput?(creds: VideoCredentials, input: { title?: string; maxDurationSeconds: number }): Promise<LiveInput>;
  endLiveInput?(creds: VideoCredentials, externalId: string): Promise<void>;
}
