import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peebee Gas — Fuel Merchant",
    short_name: "Peebee Gas",
    description: "Petrol station merchant & pump attendant voucher redemption for Peebee riders",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F3EE",
    theme_color: "#C9A227",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
