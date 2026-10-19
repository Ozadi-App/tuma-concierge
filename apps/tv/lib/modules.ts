import { BookOpen, LayoutGrid, Radio, type LucideIcon } from "lucide-react";

/**
 * What the TV's home screen can open. Adding one is a line here and a route under /app.
 * Only things that exist are listed: nothing on the home screen is a placeholder.
 * `needs` ties a tile to an admin switch the API reports for this TV, so a switched-off feature disappears instead of failing.
 */
export type TvModule = { id: string; title: string; description: string; href: string; icon: LucideIcon; needs: "learn" | "live" };

export const MODULES: TvModule[] = [
  {
    id: "my-courses",
    title: "My courses",
    description: "Pick up where you left off: lessons, videos and quizzes from the courses you've joined.",
    href: "/courses",
    icon: BookOpen,
    needs: "learn",
  },
  {
    id: "browse",
    title: "Browse courses",
    description: "Find something new to learn, from kindergarten to university and practical skills.",
    href: "/browse",
    icon: LayoutGrid,
    needs: "learn",
  },
  {
    id: "live",
    title: "Live class",
    description: "Show a live class on this screen. Tutors choose it in Peebee Learn; students answer on their phones.",
    href: "/learn",
    icon: Radio,
    needs: "live",
  },
];
