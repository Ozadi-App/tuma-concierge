import type { Metadata } from "next";
import { absoluteImage, ugx } from "../../../lib/public-share";
import { causePath, clipText, fetchPublicCause, siteUrl } from "../../../lib/public-channels";
import { CausePageClient } from "./CausePageClient";

type Props = { params: Promise<{ slug: string }> };

/** A cause's own link: works with no account and no app, and previews well when shared. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicCause(slug);
  if (!data) return { title: "Cause | Peebee", robots: { index: false } };
  const c = data.cause;
  const title = `${c.title} | Give on Peebee`;
  const description = clipText(`${ugx(c.raisedUgx)} raised of ${ugx(c.goalUgx)}. ${c.story}`, 180);
  const image = absoluteImage(c.coverUrl ?? c.channel?.avatarUrl);
  return {
    title,
    description,
    alternates: { canonical: siteUrl(causePath(c.slug)) },
    robots: c.status === "live" || c.status === "ended" || c.status === "closed" ? undefined : { index: false },
    openGraph: { type: "website", siteName: "Peebee", url: siteUrl(causePath(c.slug)), title: c.title, description, images: [{ url: image, alt: c.title }], locale: "en_UG" },
    twitter: { card: "summary_large_image", title: c.title, description, images: [image] },
  };
}

export default async function CausePage({ params }: Props) {
  const { slug } = await params;
  return <CausePageClient slug={slug} />;
}
