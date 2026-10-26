import type { MetadataRoute } from "next";
import { dishPath, productPath, SITE_URL } from "../lib/public-share";
import { causePath, channelPath } from "../lib/public-channels";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");

/** Every live product and dish has its own page; list them for search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stores`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/restaurants`, changeFrequency: "daily", priority: 0.8 },
  ];
  try {
    const res = await fetch(`${API_URL}/v1/public/sitemap`, { next: { revalidate: 3600 } });
    if (!res.ok) return pages;
    const data = (await res.json()) as {
      products: Array<{ id: string; updatedAt: string | null }>;
      dishes: Array<{ id: string; restaurantId: string; updatedAt: string | null }>;
    };
    const when = (at: string | null) => (at ? new Date(`${at.replace(" ", "T")}Z`) : undefined);
    for (const p of data.products) pages.push({ url: `${SITE_URL}${productPath(p.id)}`, lastModified: when(p.updatedAt), changeFrequency: "weekly", priority: 0.6 });
    for (const d of data.dishes) pages.push({ url: `${SITE_URL}${dishPath(d.restaurantId, d.id)}`, lastModified: when(d.updatedAt), changeFrequency: "weekly", priority: 0.6 });
  } catch {
    // Without the API the sitemap still lists the main pages.
  }
  // Public channels and causes (an empty list when Channels is switched off).
  try {
    const res = await fetch(`${API_URL}/v1/public/channels-sitemap`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = (await res.json()) as { channels: Array<{ handle: string; updatedAt: string }>; causes: Array<{ slug: string; updatedAt: string }> };
      const when = (at: string) => new Date(`${at.replace(" ", "T")}Z`);
      for (const c of data.channels) pages.push({ url: `${SITE_URL}${channelPath(c.handle)}`, lastModified: when(c.updatedAt), changeFrequency: "daily", priority: 0.5 });
      for (const c of data.causes) pages.push({ url: `${SITE_URL}${causePath(c.slug)}`, lastModified: when(c.updatedAt), changeFrequency: "daily", priority: 0.6 });
    }
  } catch {
    // Same: the main pages are enough.
  }
  return pages;
}
