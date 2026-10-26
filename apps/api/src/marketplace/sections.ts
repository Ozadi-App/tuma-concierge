import { z } from "zod";
import { isHttpsUrl } from "../lib/validation.js";

/**
 * Store 2.0 page sections. A section's content is whatever the merchant wrote for it — nothing is invented for them —
 * and `settings` is validated per section type, so a stored page can never carry markup, scripts or odd links.
 */
export const SECTION_TYPES = ["announcement", "hero", "bundles", "featured_collection", "video_spotlight", "testimonials", "trust_badges", "faq", "contact_strip", "digital_products", "lms_courses"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const text = (max: number) => z.string().trim().max(max);

const settingsByType: Record<SectionType, z.ZodType<Record<string, unknown>>> = {
  announcement: z.object({ showTicker: z.boolean().optional(), text: text(160).optional() }).strip(),
  hero: z.object({ showCta: z.boolean().optional() }).strip(),
  bundles: z.object({ maxItems: z.number().int().min(1).max(12).optional() }).strip(),
  featured_collection: z.object({ layout: z.enum(["grid", "carousel"]).optional(), collectionId: text(80).optional() }).strip(),
  video_spotlight: z.object({
    autoPlayMuted: z.boolean().optional(),
    videoUrl: z.string().max(500).refine((v) => v === "" || isHttpsUrl(v), "Must be an https:// link").optional(),
  }).strip(),
  testimonials: z.object({
    showRatings: z.boolean().optional(),
    items: z.array(z.object({ quote: text(300).min(1), author: text(80).min(1), rating: z.number().int().min(1).max(5).optional() }).strip()).max(12).optional(),
  }).strip(),
  trust_badges: z.object({
    columns: z.number().int().min(1).max(4).optional(),
    items: z.array(z.object({ icon: text(8).optional(), title: text(60).min(1), text: text(140).optional() }).strip()).max(8).optional(),
  }).strip(),
  contact_strip: z.object({}).strip(),
  digital_products: z.object({ maxItems: z.number().int().min(1).max(24).optional() }).strip(),
  lms_courses: z.object({ maxItems: z.number().int().min(1).max(24).optional() }).strip(),
  faq: z.object({ items: z.array(z.object({ question: text(160).min(1), answer: text(600).min(1) }).strip()).max(12).optional() }).strip(),
};

export type StorefrontSectionOut = {
  id: string; type: SectionType; title: string; subtitle?: string; enabled: boolean; order: number; settings: Record<string, unknown>;
};

const sectionShape = z.object({
  id: text(60).min(1),
  type: z.enum(SECTION_TYPES),
  title: text(120),
  subtitle: text(240).optional(),
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).max(1000).default(0),
  settings: z.unknown().optional(),
});

/** Strict: for merchant input. Reports the first problem. */
export function parseSections(input: unknown): { ok: true; sections: StorefrontSectionOut[] } | { ok: false; message: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, message: "Sections list cannot be empty." };
  if (input.length > 20) return { ok: false, message: "A page can have up to 20 sections." };
  const out: StorefrontSectionOut[] = [];
  for (const raw of input) {
    const base = sectionShape.safeParse(raw);
    if (!base.success) return { ok: false, message: base.error.issues[0]?.message ?? "A section is not valid." };
    const settings = settingsByType[base.data.type].safeParse(base.data.settings ?? {});
    if (!settings.success) return { ok: false, message: `${base.data.title || base.data.type}: ${settings.error.issues[0]?.message ?? "invalid settings"}` };
    out.push({ ...base.data, settings: settings.data });
  }
  return { ok: true, sections: out };
}

/** Lenient: for output. Whatever is already stored is cleaned; anything that does not fit is dropped, never shown. */
export function cleanSections(input: unknown): StorefrontSectionOut[] {
  if (!Array.isArray(input)) return [];
  const out: StorefrontSectionOut[] = [];
  for (const raw of input.slice(0, 20)) {
    const base = sectionShape.safeParse(raw);
    if (!base.success) continue;
    const settings = settingsByType[base.data.type].safeParse(base.data.settings ?? {});
    out.push({ ...base.data, settings: settings.success ? settings.data : {} });
  }
  return out;
}
