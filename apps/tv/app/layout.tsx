import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "../components/Shell";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";
import { DataRefresh } from "@peebee/shared/data-refresh";
import { ServerPracticeFrame } from "@peebee/shared/practice-ui";

export const metadata: Metadata = {
  title: "Peebee TV",
  description: "Peebee on the big screen: live classes, lessons and more",
  icons: { icon: [{ url: "/favicon.svg?v=logo-6", sizes: "any", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" data-theme="dark">
      <body><ServiceWorkerRegister /><ServerPracticeFrame exitPath="/" />
        <Shell><DataRefresh>{children}</DataRefresh></Shell>
      </body>
    </html>
  );
}
