import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import type { Row } from "./service.js";

/**
 * Work that is illegal in Uganda, or against the Constitution, is not allowed on
 * Peebee. Every job and worker profile is screened against the admin-editable
 * list of prohibited terms: a "block" term stops it outright, a "review" term
 * lets it through to staff first. This is a first line of defence, not the only
 * one: users can report anything, and staff can take anything down.
 */

export type Screening = { state: "clear" | "review" | "blocked"; matches: { term: string; category: string; action: "block" | "review" }[] };

let cache: { at: number; terms: { term: string; category: string; action: "block" | "review"; re: RegExp }[] } | null = null;
export function resetModerationCache() {
  cache = null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Lower-case, strip accents, and collapse separators so "S.c.a.m" or "drug-dealer" can't slip past. */
const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function loadTerms() {
  if (cache && Date.now() - cache.at < 30_000) return cache.terms;
  const rows = (await db.execute({ sql: "SELECT term, category, action FROM talent_prohibited_terms WHERE active = 1", args: [] })).rows as Row[];
  const terms = rows
    .map((r) => ({ term: String(r.term), category: String(r.category), action: (r.action === "review" ? "review" : "block") as "block" | "review" }))
    .map((t) => ({ ...t, re: new RegExp(`(^| )${escapeRe(normalise(t.term))}`) }))
    .filter((t) => normalise(t.term).length > 0);
  cache = { at: Date.now(), terms };
  return terms;
}

export async function screenText(...parts: (string | null | undefined)[]): Promise<Screening> {
  const text = normalise(parts.filter(Boolean).join(" . "));
  const terms = await loadTerms();
  const matches = terms.filter((t) => t.re.test(text)).map(({ term, category, action }) => ({ term, category, action }));
  const state = matches.some((m) => m.action === "block") ? "blocked" : matches.length ? "review" : "clear";
  return { state, matches };
}

/** The message shown to a person whose post or profile was stopped. It names the category, never the term. */
export function blockedMessage(screen: Screening): string {
  const cats = [...new Set(screen.matches.filter((m) => m.action === "block").map((m) => m.category.replace(/_/g, " ")))];
  return `This can't be posted on Peebee because it appears to involve ${cats.join(", ") || "prohibited work"}. Peebee does not allow illegal or unconstitutional work.`;
}

/** Puts something in staff's review queue (a screening hit, as opposed to a user report). */
export async function queueForReview(targetType: "job" | "profile", targetId: string, screen: Screening) {
  await db.execute({
    sql: "INSERT INTO talent_reports (id, reporter_id, target_type, target_id, reason, source) VALUES (?, NULL, ?, ?, ?, 'screening')",
    args: [newId("trp"), targetType, targetId, `Matched: ${screen.matches.map((m) => `${m.category} (${m.term})`).join(", ")}`],
  });
}
