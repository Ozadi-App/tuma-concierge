import type { VideoAdapter, VideoProviderKey } from "../types.js";
import { bunnyAdapter } from "./bunny.js";
import { cloudflareStreamAdapter } from "./cloudflare-stream.js";
import { cloudinaryAdapter } from "./cloudinary.js";
import { linkAdapter } from "./link.js";
import { livepeerAdapter } from "./livepeer.js";
import { mockAdapter } from "./mock.js";
import { muxAdapter } from "./mux.js";

/** Every provider Peebee can talk to. Adding one means a new file here and one line below. */
export const VIDEO_ADAPTERS: Record<VideoProviderKey, VideoAdapter> = {
  cloudflare_stream: cloudflareStreamAdapter,
  mux: muxAdapter,
  cloudinary: cloudinaryAdapter,
  bunny: bunnyAdapter,
  livepeer: livepeerAdapter,
  link: linkAdapter,
  mock: mockAdapter,
};
