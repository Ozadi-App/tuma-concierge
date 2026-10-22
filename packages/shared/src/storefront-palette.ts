import { COLOUR_SCENES, type ColourScene } from "./colour-scenes.js";

/**
 * Storefront palette: turns a restaurant's chosen colour scene (4 swatches) into
 * vivid, accessible light and dark token sets for its own storefront, menu, dish
 * and cart screens. Every text/fill pairing is pushed until it meets WCAG AA
 * (4.5:1 for text, 3:1 for large UI shapes). Peebee's solid gold Pay stays as is.
 */
export type StorefrontMode = "light" | "dark";
export type StorefrontTokens = {
  page: string; surface: string; surfaceMuted: string; line: string;
  ink: string; inkMuted: string;
  accent: string; onAccent: string; accentText: string; accentSoft: string;
  heroFrom: string; heroTo: string; onHero: string;
  badge: string; onBadge: string; tab: string; onTab: string; ring: string;
};
type RGB = [number, number, number];
const hex = (h: string): RGB => { const v = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB; };
const toHex = (c: RGB) => "#" + c.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as RGB;
const lum = (c: RGB) => { const [r, g, b] = c.map((n) => { const s = n / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
export const contrast = (a: string, b: string) => { const x = lum(hex(a)), y = lum(hex(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [12, 12, 12];
/** Move `c` toward `toward` until it reaches `min` contrast against `bg`. */
function push(c: RGB, bg: string, min: number, toward: RGB): string {
  for (let t = 0; t <= 1.0001; t += 0.02) { const h = toHex(mix(c, toward, t)); if (contrast(h, bg) >= min) return h; }
  return toHex(toward);
}
const bestInk = (bg: string) => (contrast("#ffffff", bg) >= contrast("#0c0c0c", bg) ? "#ffffff" : "#0c0c0c");

export function storefrontTokens(scene: ColourScene, mode: StorefrontMode): StorefrontTokens {
  const def = COLOUR_SCENES.find((s) => s.id === scene) ?? COLOUR_SCENES[0];
  const [p, s, w] = def.colours.map(hex) as [RGB, RGB, RGB, RGB];
  if (mode === "light") {
    const page = toHex(mix(WHITE, s, 0.07)), surface = "#ffffff";
    const accent = push(p, "#ffffff", 4.5, BLACK);
    const tab = accent;
    const badge = toHex(w);
    return {
      page, surface, surfaceMuted: toHex(mix(WHITE, s, 0.13)), line: toHex(mix(WHITE, p, 0.16)),
      ink: "#141414", inkMuted: push(mix(BLACK, p, 0.25), page, 4.5, BLACK),
      accent, onAccent: bestInk(accent), accentText: push(p, page, 4.5, BLACK), accentSoft: toHex(mix(WHITE, s, 0.2)),
      heroFrom: push(p, "#ffffff", 4.5, BLACK), heroTo: push(s, "#ffffff", 3, BLACK), onHero: "#ffffff",
      badge, onBadge: push(mix(BLACK, p, 0.2), badge, 4.5, BLACK), tab, onTab: bestInk(tab), ring: accent,
    };
  }
  const base: RGB = [14, 14, 16];
  const page = toHex(mix(base, p, 0.16)), surface = toHex(mix([28, 28, 30], p, 0.2));
  const accent = push(mix(p, s, 0.5), page, 3, WHITE);
  const badge = toHex(w);
  return {
    page, surface, surfaceMuted: toHex(mix([36, 36, 40], p, 0.24)), line: toHex(mix(hex(surface), s, 0.22)),
    ink: "#f5f5f5", inkMuted: push(mix(WHITE, s, 0.3), surface, 4.5, WHITE),
    accent, onAccent: bestInk(accent), accentText: push(s, page, 4.5, WHITE), accentSoft: toHex(mix(hex(page), s, 0.22)),
    heroFrom: toHex(mix(p, BLACK, 0.25)), heroTo: toHex(mix(s, BLACK, 0.35)), onHero: "#ffffff",
    badge, onBadge: bestInk(badge), tab: accent, onTab: bestInk(accent), ring: push(s, page, 3, WHITE),
  };
}

/** CSS custom properties for a storefront scope (e.g. a preview frame or the restaurant page). */
export function storefrontStyle(scene: ColourScene, mode: StorefrontMode): Record<string, string> {
  const t = storefrontTokens(scene, mode);
  return Object.fromEntries(Object.entries(t).map(([k, v]) => ["--sf-" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), v]));
}

/** Text/fill pairs that must pass AA; used by tests and the palette report. */
export function storefrontChecks(t: StorefrontTokens) {
  return [
    ["ink on page", t.ink, t.page, 4.5], ["muted on page", t.inkMuted, t.page, 4.5], ["ink on surface", t.ink, t.surface, 4.5],
    ["accent text on page", t.accentText, t.page, 4.5], ["on-accent on accent", t.onAccent, t.accent, 4.5],
    ["on-badge on badge", t.onBadge, t.badge, 4.5], ["on-tab on tab", t.onTab, t.tab, 4.5],
    ["on-hero on hero start", t.onHero, t.heroFrom, 4.5], ["on-hero on hero end", t.onHero, t.heroTo, 3], ["accent shape on page", t.accent, t.page, 3],
  ].map(([name, fg, bg, min]) => ({ name: name as string, ratio: contrast(fg as string, bg as string), min: min as number }));
}
