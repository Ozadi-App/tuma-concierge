import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peebee Learn",
    short_name: "Peebee Learn",
    description: "Create schools, classes, courses and lessons for every stage of learning",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png?v=logo-6", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=logo-6", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
