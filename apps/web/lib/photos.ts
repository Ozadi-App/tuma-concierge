import lum from "./photo-lum.json";
import type { DoorId } from "./doors";

export type Photo = { hero: string; card: string; alt: string; darkSide: "left" | "right"; lightSide: "left" | "right" };

const alts: Record<DoorId, string> = {
  ride: "A boda rider and passenger on a palm-lined boulevard below city towers at golden hour (AI-generated)",
  buy: "A woman choosing fresh produce outside an elegant modern grocery (AI-generated)",
  eat: "A couple dining on a terrace over the city at sunset (AI-generated)",
  learn: "A young woman on a video lesson in a high-rise study with city views (AI-generated)",
  hive: "A woman in a crisp uniform polishing a marble counter in a modern apartment (AI-generated)",
};

/** Which half of each hero photo is darker / brighter, measured at build time (tools/scripts/photos.mjs). */
export const PHOTOS = Object.fromEntries(
  (Object.keys(alts) as DoorId[]).map((id) => {
    const l = (lum as Record<string, { left: number; right: number }>)[id];
    const darkSide = l.left <= l.right ? "left" : "right";
    return [id, { hero: `/photos/hero-${id}.webp`, card: `/photos/card-${id}.webp`, alt: alts[id], darkSide, lightSide: darkSide === "left" ? "right" : "left" } as Photo];
  }),
) as Record<DoorId, Photo>;
