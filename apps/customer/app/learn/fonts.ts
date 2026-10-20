import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google";

// The Learn screens have their own type: a display face for headings, a clean body face and a mono face for codes.
// Each screen sets the variables on its root, so nothing outside Learn changes.
export const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-lh-display", display: "swap" });
export const bodyFont = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-lh-body", display: "swap" });
export const monoFont = DM_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-lh-mono", display: "swap" });
