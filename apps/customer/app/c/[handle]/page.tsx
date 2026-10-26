import type { Metadata } from "next";
import { absoluteImage } from "../../../lib/public-share";
import { channelPath, clipText, fetchPublicChannel, siteUrl } from "../../../lib/public-channels";
import { ChannelPageClient } from "./ChannelPageClient";

type Props = { params: Promise<{ handle: string }> };

/** A channel's own page: its name, bio and picture for search engines and link previews. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await fetchPublicChannel(handle);
  if (!data) return { title: "Channel | Peebee", robots: { index: false } };
  const c = data.channel;
  const title = `${c.displayName} (@${c.handle}) on Peebee`;
  const description = clipText(c.bio || `Follow ${c.displayName} on Peebee for new posts, memberships and more.`, 160);
  const image = absoluteImage(c.bannerUrl ?? c.avatarUrl);
  return {
    title,
    description,
    alternates: { canonical: siteUrl(channelPath(c.handle)) },
    openGraph: { type: "profile", siteName: "Peebee", url: siteUrl(channelPath(c.handle)), title, description, images: [{ url: image, alt: c.displayName }], locale: "en_UG" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ChannelPage({ params }: Props) {
  const { handle } = await params;
  return <ChannelPageClient handle={handle} />;
}
