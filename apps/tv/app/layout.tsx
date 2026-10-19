import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "../components/Shell";

export const metadata: Metadata = {
  title: "Peebee TV",
  description: "Peebee on the big screen: live classes, lessons and more",
  icons: { icon: [{ url: "/favicon.svg?v=logo-6", sizes: "any", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
