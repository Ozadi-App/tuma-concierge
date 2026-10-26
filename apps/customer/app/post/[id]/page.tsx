import type { Metadata } from "next";
import { absoluteImage } from "../../../lib/public-share";
import { clipText, fetchPublicPost, postPath, siteUrl } from "../../../lib/public-channels";
import { PostPageClient } from "./PostPageClient";

type Props = { params: Promise<{ id: string }> };

/** One post's own link. A locked post previews only what its creator lets the public see. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchPublicPost(id);
  if (!data) return { title: "Post | Peebee", robots: { index: false } };
  const p = data.post;
  const who = p.publisher?.name ?? "Peebee";
  const title = `${clipText(p.caption || "A post", 60)} · ${who}`;
  const description = clipText(p.caption || `A post by ${who} on Peebee.`, 160);
  const image = absoluteImage(p.media.coverUrl ?? (p.media.images[0] as string | undefined) ?? p.publisher?.avatarUrl);
  return {
    title,
    description,
    alternates: { canonical: siteUrl(postPath(p.id)) },
    openGraph: { type: "article", siteName: "Peebee", url: siteUrl(postPath(p.id)), title, description, images: [{ url: image }], locale: "en_UG" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  return <PostPageClient id={id} />;
}
