import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/public-share";

/** Product and dish pages are public; account, order and payment pages are not for search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/product/", "/restaurants/", "/stores", "/c/", "/give/", "/post/"],
      disallow: ["/orders", "/wallet", "/account", "/settings", "/cart", "/chat", "/login", "/verify", "/activate", "/trip/", "/practice", "/studio"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
