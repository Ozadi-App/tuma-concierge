import { MODULE_NOTICE_REASONS, type ModuleNotice } from "./modules.js";

/**
 * Which screens belong to which module, per app. `prefix` matches that path and everything under it; `exact` matches only
 * that path (an app's home). The longest matching rule wins, so `/ride/car` beats `/ride`.
 */
export type ModuleRouteRule = { prefix: string; module: string; title: string; exact?: boolean };

export function moduleForPath(pathname: string, rules: readonly ModuleRouteRule[]): ModuleRouteRule | null {
  let best: ModuleRouteRule | null = null;
  for (const rule of rules) {
    const hit = rule.exact ? pathname === rule.prefix : pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
    if (hit && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  }
  return best;
}

/** What a notice says, in words: the reason's headline, the date line if there is a date, and Admin's own message. */
export function describeModuleNotice(notice: ModuleNotice): { headline: string; dateLine: string | null; message: string | null } {
  const reason = MODULE_NOTICE_REASONS.find((r) => r.id === notice.reason) ?? MODULE_NOTICE_REASONS[2]!;
  let dateLine: string | null = null;
  if (notice.returnAt) {
    const when = new Date(notice.returnAt);
    if (Number.isFinite(when.getTime())) {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(notice.returnAt);
      const day = when.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
      const time = dateOnly ? "" : ` at ${when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      dateLine = `${reason.dateLabel} ${day}${time}`;
    }
  }
  return { headline: reason.headline, dateLine, message: notice.message ?? null };
}
