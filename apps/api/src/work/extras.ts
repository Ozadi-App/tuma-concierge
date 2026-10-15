import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { hasPermission, type AdminRole } from "@peebee/shared";
import type { RequestUser } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { notifyUser } from "../lib/webpush.js";
import { getR2Bucket, uploadResponseHeaders } from "../storage/r2.js";
import { getJob } from "./jobs.js";
import { canWork, logEvent, openJobsFor, providerFor, toDb, workExtrasReady, type Row } from "./service.js";
import { getWorkSettings } from "./settings.js";

/**
 * Photos, chat and live location for a job. These need migration 0099; until it is applied they answer
 * "upgrade pending" and nothing else is affected. Each can be switched off from Admin.
 */
export const extrasRoutes = new Hono();

extrasRoutes.use("*", async (c, next) => {
  const path = c.req.path;
  // Only the routes below; other work routes are mounted separately.
  if (/\/(photos|messages|location)(\/|$)/.test(path)) {
    if (!(await workExtrasReady())) {
      return c.json({ error: "work_upgrade_pending", message: "This feature is being set up. Try again shortly." }, 503);
    }
  }
  await next();
});

// ---------------------------------------------------------------------------
// Who is allowed to touch a job
// ---------------------------------------------------------------------------

type Side =
  | { kind: "customer"; job: Row }
  | { kind: "provider"; job: Row; ctx: { provider: Row; role: "owner" | "staff" } }
  | { kind: "admin"; job: Row };

/** The signed-in person's relationship to this job, or null (answered as "not found" so jobs can't be probed). */
async function sideOf(c: Context, jobId: string): Promise<Side | null> {
  const user = c.get("user") as RequestUser;
  const job = await getJob(jobId);
  if (!job) return null;
  if (user.role === "admin") return hasPermission(user.adminRole as AdminRole | null | undefined, "work.view") ? { kind: "admin", job } : null;
  if (job.customer_id === user.sub) return { kind: "customer", job };
  const ctx = await providerFor(user.sub);
  if (ctx && job.provider_id === ctx.provider.id && (ctx.role === "owner" || job.worker_id === user.sub)) return { kind: "provider", job, ctx };
  return null;
}

const NOT_FOUND = { error: "not_found", message: "Job not found." } as const;
const LIVE_STATUSES = ["open", "assigned", "quoted", "booked", "in_progress", "completed", "disputed"];

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The declared type came from the client; the bytes decide. */
function detectImage(bytes: Uint8Array): { ext: string; type: string } | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return { ext: "jpg", type: "image/jpeg" };
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return { ext: "png", type: "image/png" };
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { ext: "webp", type: "image/webp" };
  return null;
}

const photoView = (r: Row) => ({
  id: r.id, phase: r.phase, uploaderKind: r.uploader_kind, note: r.note ?? null, sizeBytes: Number(r.size_bytes), createdAt: r.created_at,
});

async function addPhoto(c: Context, jobId: string, forSide: "customer" | "provider") {
  const user = c.get("user") as RequestUser;
  const settings = await getWorkSettings();
  if (!settings.photosEnabled) return c.json({ error: "photos_disabled", message: "Photos are switched off right now." }, 503);
  const side = await sideOf(c, jobId);
  if (!side || side.kind !== forSide) return c.json(NOT_FOUND, 404);
  const job = side.job;

  // A provider adds before/after photos once the job is theirs and until it is paid out; a customer can add to a live job.
  const allowed = forSide === "provider" ? ["booked", "in_progress", "completed"] : LIVE_STATUSES;
  if (!allowed.includes(String(job.status))) return c.json({ error: "job_closed", message: "This job isn't accepting photos right now." }, 409);

  const limit = await consume(`work:photo:${user.sub}`, 30, 3600);
  if (!limit.allowed) return c.json({ error: "rate_limited", message: "Too many photos. Try again later." }, 429);

  const count = Number(((await db.execute({ sql: "SELECT COUNT(*) AS n FROM work_job_photos WHERE job_id = ?", args: [job.id] })).rows[0] as Row).n);
  if (count >= settings.maxPhotosPerJob) return c.json({ error: "too_many_photos", message: `A job can have up to ${settings.maxPhotosPerJob} photos.` }, 409);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "missing_file", message: "Choose a photo." }, 400);
  if (file.size > settings.maxPhotoKb * 1024) return c.json({ error: "file_too_large", message: `Photos can be up to ${Math.round(settings.maxPhotoKb / 1024 * 10) / 10} MB.` }, 400);
  if (!IMAGE_TYPES.has(file.type.split(";")[0].trim().toLowerCase())) return c.json({ error: "unsupported_file_type", message: "Use a JPEG, PNG or WebP photo." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return c.json({ error: "unsupported_file_type", message: "That file isn't a valid photo." }, 400);

  const phaseRaw = String(form?.get("phase") ?? (forSide === "provider" ? "after" : "request"));
  const phase = forSide === "customer" ? "request" : phaseRaw === "before" ? "before" : "after";
  const note = String(form?.get("note") ?? "").trim().slice(0, 200) || null;

  const id = newId("wph");
  const key = `work/${job.id}/${id}.${detected.ext}`;
  await getR2Bucket().put(key, bytes, { httpMetadata: { contentType: detected.type } });
  await db.execute({
    sql: `INSERT INTO work_job_photos (id, job_id, uploader_id, uploader_kind, phase, storage_key, content_type, size_bytes, note, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, job.id, user.sub, forSide, phase, key, detected.type, bytes.length, note, job.environment === "sandbox" ? "sandbox" : "live"],
  });
  await logEvent(String(job.id), user.sub, forSide, "photo_added", { photoId: id, phase });
  return c.json({ photo: { id, phase, uploaderKind: forSide, note, sizeBytes: bytes.length, createdAt: toDb() } }, 201);
}

extrasRoutes.post("/jobs/:id/photos", (c) => addPhoto(c, c.req.param("id") as string, "customer"));
extrasRoutes.post("/provider/jobs/:id/photos", (c) => addPhoto(c, c.req.param("id") as string, "provider"));

async function listPhotos(c: Context, jobId: string) {
  const user = c.get("user") as RequestUser;
  const side = await sideOf(c, jobId);
  if (side) {
    const rows = (await db.execute({ sql: "SELECT * FROM work_job_photos WHERE job_id = ? ORDER BY created_at", args: [jobId] })).rows as Row[];
    return c.json({ photos: rows.map(photoView) });
  }
  // A provider can see the customer's request photos on an open job they could take, to help them offer or quote.
  const ctx = await providerFor(user.sub);
  const settings = await getWorkSettings();
  if (ctx && ctx.role === "owner" && canWork(ctx.provider, settings) && (await openJobsFor(ctx.provider, settings)).some((j) => j.id === jobId)) {
    const rows = (await db.execute({ sql: "SELECT * FROM work_job_photos WHERE job_id = ? AND phase = 'request' ORDER BY created_at", args: [jobId] })).rows as Row[];
    return c.json({ photos: rows.map(photoView) });
  }
  return c.json(NOT_FOUND, 404);
}
extrasRoutes.get("/jobs/:id/photos", (c) => listPhotos(c, c.req.param("id") as string));
extrasRoutes.get("/provider/jobs/:id/photos", (c) => listPhotos(c, c.req.param("id") as string));

/** The photo itself. Private: only people on the job (or staff) can fetch it. */
extrasRoutes.get("/photos/:photoId", async (c) => {
  const user = c.get("user") as RequestUser;
  const photo = (await db.execute({ sql: "SELECT * FROM work_job_photos WHERE id = ?", args: [c.req.param("photoId") as string] })).rows[0] as Row | undefined;
  if (!photo) return c.json({ error: "not_found" }, 404);
  let allowed = !!(await sideOf(c, String(photo.job_id)));
  if (!allowed && photo.phase === "request") {
    const ctx = await providerFor(user.sub);
    const settings = await getWorkSettings();
    allowed = !!ctx && ctx.role === "owner" && canWork(ctx.provider, settings) && (await openJobsFor(ctx.provider, settings)).some((j) => j.id === photo.job_id);
  }
  if (!allowed) return c.json({ error: "not_found" }, 404);
  const object = await getR2Bucket().get(String(photo.storage_key));
  if (!object) return c.json({ error: "not_found" }, 404);
  return new Response(object.body, { headers: { ...uploadResponseHeaders(object.httpMetadata?.contentType, String(photo.content_type)), "Cache-Control": "private, no-store" } });
});

// ---------------------------------------------------------------------------
// Chat between the customer and the provider on the job
// ---------------------------------------------------------------------------

const messageSchema = z.object({ body: z.string().trim().min(1).max(1000) });

async function listMessages(c: Context, jobId: string) {
  const settings = await getWorkSettings();
  if (!settings.chatEnabled) return c.json({ error: "chat_disabled", message: "Messaging is switched off right now." }, 503);
  const side = await sideOf(c, jobId);
  if (!side) return c.json(NOT_FOUND, 404);
  const after = c.req.query("after");
  const rows = (
    await db.execute({
      sql: `SELECT m.id, m.sender_kind, m.body, m.created_at, u.name AS sender_name FROM work_messages m JOIN users u ON u.id = m.sender_id
            WHERE m.job_id = ? ${after ? "AND m.rowid > COALESCE((SELECT rowid FROM work_messages WHERE id = ? AND job_id = ?), 0)" : ""} ORDER BY m.rowid LIMIT 200`,
      args: after ? [jobId, after, jobId] : [jobId],
    })
  ).rows as Row[];
  return c.json({ messages: rows.map((m) => ({ id: m.id, from: m.sender_kind, senderName: m.sender_name, body: m.body, createdAt: m.created_at })) });
}

async function sendMessage(c: Context, jobId: string, forSide: "customer" | "provider") {
  const user = c.get("user") as RequestUser;
  const settings = await getWorkSettings();
  if (!settings.chatEnabled) return c.json({ error: "chat_disabled", message: "Messaging is switched off right now." }, 503);
  const side = await sideOf(c, jobId);
  if (!side || side.kind !== forSide) return c.json(NOT_FOUND, 404);
  const job = side.job;
  // Only once there is someone to talk to, and until the job is paid out or closed.
  if (!job.provider_id || !["assigned", "quoted", "booked", "in_progress", "completed", "disputed"].includes(String(job.status))) {
    return c.json({ error: "chat_closed", message: "Messages open once a provider is on the job and close when it ends." }, 409);
  }
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Write a message of up to 1,000 characters." }, 400);
  const limit = await consume(`work:msg:${user.sub}:${job.id}`, 30, 60);
  if (!limit.allowed) return c.json({ error: "rate_limited", message: "You're sending messages too fast." }, 429);

  const id = newId("wms");
  await db.execute({ sql: "INSERT INTO work_messages (id, job_id, sender_id, sender_kind, body) VALUES (?, ?, ?, ?, ?)", args: [id, job.id, user.sub, forSide, parsed.data.body] });

  // Tell the other side. The provider side is the worker doing the job, or the provider owner when none is assigned.
  const recipient = forSide === "customer" ? String(job.worker_id ?? (await providerOwner(String(job.provider_id)))) : String(job.customer_id);
  if (recipient) {
    notifyUser(recipient, {
      title: `Message about ${job.service_name}`, body: parsed.data.body.slice(0, 120),
      url: forSide === "customer" ? `/jobs/${job.id}` : `/services/work/${job.id}`, tag: `work-msg-${job.id}`,
    }).catch(() => {});
  }
  return c.json({ message: { id, from: forSide, body: parsed.data.body, createdAt: toDb() } }, 201);
}

async function providerOwner(providerId: string): Promise<string | null> {
  const row = (await db.execute({ sql: "SELECT user_id FROM work_providers WHERE id = ?", args: [providerId] })).rows[0] as Row | undefined;
  return row ? String(row.user_id) : null;
}

extrasRoutes.get("/jobs/:id/messages", (c) => listMessages(c, c.req.param("id") as string));
extrasRoutes.post("/jobs/:id/messages", (c) => sendMessage(c, c.req.param("id") as string, "customer"));
extrasRoutes.get("/provider/jobs/:id/messages", (c) => listMessages(c, c.req.param("id") as string));
extrasRoutes.post("/provider/jobs/:id/messages", (c) => sendMessage(c, c.req.param("id") as string, "provider"));

// ---------------------------------------------------------------------------
// Live location: the provider side reports where they are, the customer sees it on the job
// ---------------------------------------------------------------------------

const locationSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

extrasRoutes.post("/provider/jobs/:id/location", async (c) => {
  const user = c.get("user") as RequestUser;
  const settings = await getWorkSettings();
  if (!settings.trackingEnabled) return c.json({ error: "tracking_disabled", message: "Location sharing is switched off right now." }, 503);
  const side = await sideOf(c, c.req.param("id") as string);
  if (!side || side.kind !== "provider") return c.json(NOT_FOUND, 404);
  const parsed = locationSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", message: "Send a valid location." }, 400);
  // Only the person doing the job reports it, and only while the job is on.
  const doer = side.job.worker_id ?? (await providerOwner(String(side.job.provider_id)));
  if (doer !== user.sub) return c.json({ error: "not_your_job", message: "Only the person doing this job can share their location." }, 403);
  if (!["booked", "in_progress"].includes(String(side.job.status))) return c.json({ error: "job_not_active", message: "Location is shared while the job is booked or in progress." }, 409);

  // At most one update every few seconds is stored; extra pings are accepted and dropped.
  const res = await db.execute({
    sql: `UPDATE work_jobs SET provider_lat = ?, provider_lng = ?, provider_located_at = datetime('now')
          WHERE id = ? AND status IN ('booked', 'in_progress') AND (provider_located_at IS NULL OR provider_located_at <= datetime('now', '-4 seconds'))`,
    args: [parsed.data.lat, parsed.data.lng, side.job.id],
  });
  return c.json({ ok: true, stored: (res.rowsAffected ?? 0) === 1 });
});
