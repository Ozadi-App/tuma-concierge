import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_DOORS, doorFromSlug, DOOR_SLUG } from "../../lib/door-ids";
import { DOOR_CONTENT } from "../../lib/content";

export const dynamicParams = false;
export function generateStaticParams() {
  return DEFAULT_DOORS.map((d) => ({ door: DOOR_SLUG[d.id] }));
}

export async function generateMetadata({ params }: { params: Promise<{ door: string }> }): Promise<Metadata> {
  const { door } = await params;
  const id = doorFromSlug(door);
  if (!id) return {};
  const d = DEFAULT_DOORS.find((x) => x.id === id)!;
  return { title: d.label, description: DOOR_CONTENT[id].lead };
}

// Deep links like /ride or /work show the home with that door open (drawn by <Shell>).
export default async function Page({ params }: { params: Promise<{ door: string }> }) {
  const { door } = await params;
  if (!doorFromSlug(door)) notFound();
  return null;
}
