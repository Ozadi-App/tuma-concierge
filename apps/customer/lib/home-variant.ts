export const HOME_VARIANTS = ["a", "b", "c"] as const;
export type HomeVariant = (typeof HOME_VARIANTS)[number];

/** `a` brand hero, `b` launcher, `c` today. Anything else stays on the brand hero. */
export function parseHomeVariant(value: string | null | undefined): HomeVariant {
  return value === "b" || value === "c" ? value : "a";
}
