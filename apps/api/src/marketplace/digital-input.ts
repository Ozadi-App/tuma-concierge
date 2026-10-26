import { z } from "zod";
import { httpsUrl } from "../lib/validation.js";

type Body = Record<string, unknown>;

/** The merchant app sends snake_case; older callers sent camelCase. Both mean the same thing. */
function pick(body: Body, ...keys: string[]): unknown {
  for (const key of keys) if (body[key] !== undefined && body[key] !== null) return body[key];
  return undefined;
}

const intIn = (min: number, max: number) => z.number().int().min(min).max(max);

export const DIGITAL_KINDS = ["download", "license_key", "course", "template", "service"] as const;

const digitalProductSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(160),
  kind: z.enum(DIGITAL_KINDS).default("download"),
  description: z.string().trim().max(4000).default(""),
  price_ugx: intIn(0, 100_000_000),
  compare_at_price_ugx: intIn(0, 100_000_000).nullable().default(null),
  file_url: httpsUrl(1000).default(""),
  file_name: z.string().trim().max(200).default(""),
  file_size_bytes: intIn(0, 5_000_000_000).default(0),
  mime_type: z.string().trim().max(100).default("application/octet-stream"),
  max_downloads: intIn(0, 1000).optional(),
  expiry_days: intIn(0, 3650).optional(),
  license_keys_pool: z.array(z.string().trim().min(1).max(200)).max(5000).default([]),
  delivery_instructions: z.string().trim().max(2000).default(""),
  cover_image_url: httpsUrl(1000).default(""),
  linked_course_id: z.string().max(80).nullable().default(null),
  status: z.enum(["published", "draft", "archived"]).default("published"),
});

export type DigitalProductInput = z.infer<typeof digitalProductSchema>;

export function parseDigitalProduct(body: Body) {
  const raw = {
    title: pick(body, "title"),
    kind: pick(body, "kind"),
    description: pick(body, "description"),
    price_ugx: pick(body, "price_ugx", "priceUgx") ?? 0,
    compare_at_price_ugx: pick(body, "compare_at_price_ugx", "compareAtPriceUgx") ?? null,
    file_url: pick(body, "file_url", "fileUrl"),
    file_name: pick(body, "file_name", "fileName"),
    file_size_bytes: pick(body, "file_size_bytes", "fileSizeBytes"),
    mime_type: pick(body, "mime_type", "mimeType"),
    max_downloads: pick(body, "max_downloads", "maxDownloads"),
    expiry_days: pick(body, "expiry_days", "expiryDays"),
    license_keys_pool: pick(body, "license_keys_pool"),
    delivery_instructions: pick(body, "delivery_instructions", "deliveryInstructions"),
    cover_image_url: pick(body, "cover_image_url", "coverImageUrl"),
    linked_course_id: pick(body, "linked_course_id", "linkedCourseId"),
    status: pick(body, "status"),
  };
  const parsed = digitalProductSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues };
  const data = parsed.data;
  // Keys are secrets and must be unique within a pool.
  data.license_keys_pool = [...new Set(data.license_keys_pool)];
  return { ok: true as const, data };
}

export const COURSE_STREAMS = ["skills", "academy", "compass", "sprouts", "foundations", "campus"] as const;

const lessonSchema = z.object({
  id: z.string().max(80).optional(),
  title: z.string().trim().min(1).max(200),
  content_type: z.string().trim().min(1).max(30).default("video"),
  duration_minutes: intIn(0, 1440).default(15),
  summary: z.string().trim().max(2000).default(""),
  content_url: httpsUrl(1000).default(""),
});
const moduleSchema = z.object({
  id: z.string().max(80).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  lessons: z.array(lessonSchema).max(200).default([]),
});
const courseSchema = z.object({
  id: z.string().max(80).optional(),
  title: z.string().trim().min(2, "Course title is required").max(200),
  summary: z.string().trim().max(4000).default(""),
  price_ugx: intIn(0, 100_000_000).default(0),
  stream: z.enum(COURSE_STREAMS).default("skills"),
  status: z.enum(["draft", "published"]).default("published"),
  modules: z.array(moduleSchema).max(50).optional(),
});

export type CourseInput = z.infer<typeof courseSchema>;

export function parseCourse(body: Body) {
  const modules = Array.isArray(body.modules)
    ? body.modules.map((m: Body) => ({
        id: pick(m, "id"),
        title: pick(m, "title"),
        description: pick(m, "description"),
        lessons: Array.isArray(m.lessons)
          ? m.lessons.map((l: Body) => ({
              id: pick(l, "id"),
              title: pick(l, "title"),
              content_type: pick(l, "content_type", "kind"),
              duration_minutes:
                pick(l, "duration_minutes") ?? (pick(l, "durationSeconds") != null ? Math.max(1, Math.round(Number(pick(l, "durationSeconds")) / 60)) : undefined),
              summary: pick(l, "summary"),
              content_url: pick(l, "content_url", "contentUrl"),
            }))
          : undefined,
      }))
    : undefined;
  const parsed = courseSchema.safeParse({
    id: pick(body, "id"),
    title: pick(body, "title"),
    summary: pick(body, "summary"),
    price_ugx: pick(body, "price_ugx", "priceUgx"),
    stream: pick(body, "stream"),
    status: pick(body, "status"),
    modules,
  });
  return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const, issues: parsed.error.issues };
}

export const enrollmentSchema = z.object({
  courseId: z.string().min(1).max(80),
  studentName: z.string().trim().min(2).max(120),
  studentPhone: z.string().trim().min(6).max(30),
  studentEmail: z.string().email().max(200).optional().or(z.literal("")),
  sendSmsNotice: z.boolean().optional(),
});
