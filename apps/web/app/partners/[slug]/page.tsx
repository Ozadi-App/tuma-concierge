import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGACY_PARTNERS, PARTNER_TYPES, PARTNER_TYPE_BY_SLUG } from "../../../lib/partners";
import { PartnerTypePage } from "../../../components/PartnerTypePage";
import { LegacyPartnerRedirect } from "../../../components/LegacyPartnerRedirect";
import { ModuleGate } from "../../../components/ModuleNotice";
import { moduleOfPartner } from "../../../lib/module-map";

export const dynamicParams = false;
export function generateStaticParams() {
  return [...PARTNER_TYPES.map((p) => p.slug), ...Object.keys(LEGACY_PARTNERS)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PARTNER_TYPE_BY_SLUG[slug];
  return p ? { title: `${p.name} · Partner with Peebee`, description: p.lead } : { robots: { index: false } };
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (LEGACY_PARTNERS[slug]) return <LegacyPartnerRedirect slug={slug} />;
  const p = PARTNER_TYPE_BY_SLUG[slug];
  if (!p) notFound();
  return <ModuleGate module={moduleOfPartner(p.slug, p.door)} name={p.name}><PartnerTypePage p={p} /></ModuleGate>;
}
