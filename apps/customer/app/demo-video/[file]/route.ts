import { getCloudflareContext } from "@opennextjs/cloudflare";

// Serves the sandbox demo clips (public/demo-video-src/) with HTTP byte-range
// support. Workers Static Assets always answer 200 with the full body, and
// iOS/Safari refuses to play an MP4 unless the server returns 206 for Range
// requests. Files are tiny (<2.5 MB), so slicing in memory is fine.
// Credits: packages/shared/src/demo-media-CREDITS.md

export const dynamic = "force-dynamic";

const FILE_RE = /^[a-z0-9-]+\.(mp4|jpg)$/;
const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg" };

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return serve(req, (await ctx.params).file, true);
}

export async function HEAD(req: Request, ctx: { params: Promise<{ file: string }> }) {
  return serve(req, (await ctx.params).file, false);
}

async function serve(req: Request, file: string, withBody: boolean): Promise<Response> {
  if (!FILE_RE.test(file)) return new Response("Not found", { status: 404 });

  const { env } = await getCloudflareContext({ async: true });
  const assets = (env as { ASSETS?: { fetch: (r: Request | string) => Promise<Response> } }).ASSETS;
  const src = new URL(`/demo-video-src/${file}`, req.url);
  const upstream = assets ? await assets.fetch(src.toString()) : await fetch(src);
  if (!upstream.ok) return new Response("Not found", { status: 404 });

  const buf = await upstream.arrayBuffer();
  const size = buf.byteLength;
  const headers = new Headers({
    "Content-Type": TYPES[file.split(".").pop()!],
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  });
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  const range = req.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (range && m && (m[1] || m[2])) {
    let start: number;
    let end: number;
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(withBody ? buf.slice(start, end + 1) : null, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(withBody ? buf : null, { status: 200, headers });
}
