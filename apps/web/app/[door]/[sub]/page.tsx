import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOOR_SLUG, doorFromSlug } from "../../../lib/door-ids";
import { SUBS, SUB_BY_ID } from "../../../lib/subs";
import { SubPage } from "../../../components/SubPage";

export const dynamicParams = false;
export function generateStaticParams() {
  return SUBS.map((s) => ({ door: DOOR_SLUG[s.door], sub: s.key }));
}

function find(door: string, sub: string) {
  const id = doorFromSlug(door);
  return id ? SUB_BY_ID[`${id}/${sub}`] : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ door: string; sub: string }> }): Promise<Metadata> {
  const { door, sub } = await params;
  const s = find(door, sub);
  return s ? { title: s.title, description: s.text } : {};
}

export default async function Page({ params }: { params: Promise<{ door: string; sub: string }> }) {
  const { door, sub } = await params;
  const s = find(door, sub);
  if (!s) notFound();
  return <SubPage sub={s} />;
}
