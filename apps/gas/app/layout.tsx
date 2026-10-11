import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "../components/AppShell";
import { AuthProvider } from "../lib/auth-context";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("peebee-theme");
    var mode = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
    var theme;
    if (mode === "auto") {
      var hour = new Date().getHours();
      theme = hour >= 6 && hour < 19 ? "light" : "dark";
    } else {
      theme = mode;
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Peebee Gas — Fuel Merchant App",
  description: "Petrol station merchant & pump attendant voucher redemption for Peebee riders",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A227",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: any;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
