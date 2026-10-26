import { z } from "zod";

/** East Africa Time (Uganda) is UTC+3 all year; booking times are wall-clock times there. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** A real calendar date: 2030-02-31 is refused even though it matches the pattern. */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isRealTime(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** The instant (epoch ms) of a wall-clock date and time in East Africa Time, or null when either is not real. */
export function eatInstant(date: string, time: string): number | null {
  if (!isRealDate(date) || !isRealTime(time)) return null;
  return new Date(`${date}T${time}:00Z`).getTime() - EAT_OFFSET_MS;
}

export const dateString = z.string().refine(isRealDate, "Not a real calendar date");
export const timeString = z.string().refine(isRealTime, "Not a real time (HH:mm)");

/** An address someone can click safely: https only, no credentials, no javascript:/data: schemes. */
export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Optional https URL that may be left empty. */
export const httpsUrl = (max = 1000) =>
  z.string().max(max).refine((v) => v === "" || isHttpsUrl(v), "Must be an https:// address");

/** Normalise a Ugandan or international phone number to +E.164 digits, or null when it is not plausible. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("00")) d = d.slice(2);
  else if (!digits.startsWith("+") && d.startsWith("0")) d = `256${d.slice(1)}`;
  return /^\d{9,15}$/.test(d) ? `+${d}` : null;
}

export const phoneString = z
  .string()
  .min(6)
  .max(30)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Not a valid phone number" });
    return n ?? v;
  });
