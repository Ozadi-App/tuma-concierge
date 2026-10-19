import { GraduationCap, type LucideIcon } from "lucide-react";

/**
 * The modules this TV app can open. Adding one is a line here and a route under /app.
 * Only modules that exist are listed: nothing on the launcher is a placeholder.
 */
export type TvModule = { id: string; title: string; description: string; href: string; icon: LucideIcon };

export const MODULES: TvModule[] = [
  {
    id: "learn",
    title: "Learn",
    description: "Attend a live class. Your tutor's lessons, questions and results appear here; students answer on their phones.",
    href: "/learn",
    icon: GraduationCap,
  },
];
