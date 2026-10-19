import { Hono } from "hono";
import { EDUCATION_STREAMS } from "@peebee/shared";
import { db } from "../db/client.js";
import { clientIp, consume, tooManyRequests } from "../lib/ratelimit.js";
import { hasColumn } from "../lib/schema.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";
import { studioReady } from "./studio.js";

/**
 * Pictures for schools, courses and lessons. Public, because they sit in <img> tags that can't send a sign-in token.
 *
 * An educator can upload a cover for a school or a course. Everything else, and anything without a cover, gets a
 * picture drawn here from its stream and title, so every card has a thumbnail from the first day with nothing to
 * set up. Nothing unpublished is revealed: a draft course or a suspended school gets a plain stream picture.
 */
export const artRoutes = new Hono();

type Row = Record<string, unknown>;

artRoutes.use("*", async (c, next) => {
  const quota = await consume(`learn-art:${clientIp(c)}`, 600, 60);
  if (!quota.allowed) return tooManyRequests(c, quota, "Too many requests. Try again in a moment.");
  await next();
});

// One hue per stream. Pictures are content, not interface, so they carry the stream's colour.
const HUE: Record<string, number> = { sprouts: 140, foundations: 34, academy: 214, compass: 176, skills: 338 };
const ICON: Record<string, string> = Object.fromEntries(EDUCATION_STREAMS.map((s) => [s.id, s.icon]));
const CONTENT_ICON: Record<string, string> = { video: "🎬", audio: "🎧", reading: "📖", quiz: "📝", exam: "📝", assignment: "✍️" };

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Breaks a title into at most `lines` lines of about `width` characters, ending with an ellipsis if it doesn't fit. */
export function wrapTitle(title: string, width = 20, lines = 3): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width || !line) line = next.length > width + 6 ? `${next.slice(0, width + 5)}…` : next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = `${kept[lines - 1]!.replace(/…$/, "")}…`;
    return kept;
  }
  return out;
}

export function drawArt(input: { stream: string; title: string; label: string; glyph?: string; seed: string }): string {
  const hue = HUE[input.stream] ?? 40;
  const h = hash(`${input.seed}:${input.title}`);
  const angle = 20 + (h % 50);
  const shift = 18 + ((h >> 4) % 22);
  const glyph = input.glyph ?? ICON[input.stream] ?? "📚";
  const circles = [0, 1, 2]
    .map((i) => {
      const x = 80 + (((h >> (i * 5)) & 31) / 31) * 520;
      const y = 30 + (((h >> (i * 5 + 2)) & 31) / 31) * 300;
      const r = 50 + (((h >> (i * 3)) & 15) / 15) * 110;
      return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="hsl(${hue + (i - 1) * 10} 70% 70%)" opacity="${0.1 + i * 0.04}"/>`;
    })
    .join("");
  const lines = wrapTitle(input.title)
    .map((t, i) => `<tspan x="36" dy="${i === 0 ? 0 : 40}">${esc(t)}</tspan>`)
    .join("");
  const top = 360 - 36 - Math.max(0, wrapTitle(input.title).length - 1) * 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="${esc(input.title)}">
<defs><linearGradient id="g" gradientTransform="rotate(${angle})"><stop offset="0" stop-color="hsl(${hue} 55% 22%)"/><stop offset="1" stop-color="hsl(${(hue + shift) % 360} 60% 12%)"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>${circles}
<rect y="140" width="640" height="220" fill="url(#f)"/>
<text x="604" y="112" font-size="84" text-anchor="end" opacity=".92">${glyph}</text>
<text x="36" y="46" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="hsl(${hue} 80% 80%)">${esc(input.label.toUpperCase())}</text>
<text x="36" y="${top}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34" font-weight="700" fill="#fff">${lines}</text>
</svg>`;
}

const svg = (body: string) =>
  new Response(body, { status: 200, headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });

async function cover(key: string): Promise<Response | null> {
  const object = await getR2Bucket().get(key);
  if (!object) return null;
  return new Response(object.body, { status: 200, headers: { ...uploadResponseHeaders(object.httpMetadata?.contentType, "image/jpeg"), "Cache-Control": "public, max-age=300" } });
}

const plain = (stream: string) => svg(drawArt({ stream, title: "Peebee Learn", label: "Learn", seed: stream }));

artRoutes.get("/:kind/:id", async (c) => {
  const kind = c.req.param("kind");
  const id = c.req.param("id");
  if (!(await studioReady())) return plain("academy");

  if (kind === "stream") return plain(id);

  if (kind === "course" || kind === "lesson") {
    const hasCover = kind === "course" && (await hasColumn("edu_courses", "cover_key"));
    const row = (
      await db.execute({
        sql:
          kind === "course"
            ? `SELECT c.id, c.title, c.stream, ${hasCover ? "c.cover_key" : "NULL"} AS cover_key, s.name AS school_name
               FROM edu_courses c JOIN edu_schools s ON s.id = c.school_id AND s.status = 'active'
               WHERE c.id = ? AND c.status = 'published'`
            : `SELECT l.id, l.title, l.content_type, c.stream, NULL AS cover_key, s.name AS school_name
               FROM edu_lessons l JOIN edu_courses c ON c.id = l.course_id AND c.status = 'published'
               JOIN edu_schools s ON s.id = c.school_id AND s.status = 'active'
               WHERE l.id = ?`,
        args: [id],
      })
    ).rows[0] as Row | undefined;
    if (!row) return plain("academy");
    if (row.cover_key) {
      const custom = await cover(String(row.cover_key));
      if (custom) return custom;
    }
    const stream = String(row.stream);
    return svg(
      drawArt({
        stream,
        title: String(row.title),
        label: kind === "course" ? String(row.school_name) : "Lesson",
        glyph: kind === "lesson" ? CONTENT_ICON[String(row.content_type)] ?? ICON[stream] : undefined,
        seed: String(row.id),
      }),
    );
  }

  if (kind === "school") {
    const hasCover = await hasColumn("edu_schools", "cover_key");
    const row = (await db.execute({ sql: `SELECT id, name, streams, tagline, ${hasCover ? "cover_key" : "NULL"} AS cover_key FROM edu_schools WHERE id = ? AND status = 'active'`, args: [id] })).rows[0] as Row | undefined;
    if (!row) return plain("academy");
    if (row.cover_key) {
      const custom = await cover(String(row.cover_key));
      if (custom) return custom;
    }
    const stream = String(row.streams ?? "").split(",")[0] || "academy";
    return svg(drawArt({ stream, title: String(row.name), label: String(row.tagline || "School"), seed: String(row.id) }));
  }

  return plain("academy");
});
