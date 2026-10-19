import { Backpack, Compass, Landmark, Sprout, Wrench, type LucideIcon } from "lucide-react";
import type { EducationStream } from "@peebee/shared";

/** How each stream is described to educators. The learner-facing copy lives in the customer app. */
export const STREAM_UI: Record<
  EducationStream,
  { title: string; audience: string; examples: string; icon: LucideIcon; unit: string }
> = {
  sprouts: {
    title: "Sprouts",
    audience: "Kindergarten · ages 3–6",
    examples: "Phonics, counting, story time, play-based learning",
    icon: Sprout,
    unit: "Classes",
  },
  foundations: {
    title: "Basics",
    audience: "Primary school · ages 6–12",
    examples: "Mathematics, English, science, social studies",
    icon: Backpack,
    unit: "Classes",
  },
  academy: {
    title: "Academy",
    audience: "Secondary & senior high · ages 12–18",
    examples: "O-Level, A-Level, IGCSE, IB and exam preparation",
    icon: Landmark,
    unit: "Classes",
  },
  compass: {
    title: "Compass",
    audience: "University & college students",
    examples: "Credit courses, lectures, labs and professional certificates",
    icon: Compass,
    unit: "Programmes",
  },
  skills: {
    title: "Skills",
    audience: "Everyday learners · any age",
    examples: "Trades, tutorials, hobbies and informal subjects",
    icon: Wrench,
    unit: "Masterclasses",
  },
};

export function formatUgx(amount: number) {
  return amount > 0 ? `UGX ${amount.toLocaleString("en-UG")}` : "Free";
}

export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** An amount of money, never "Free": zero collected is UGX 0. */
export function formatMoney(amount: number) {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}
