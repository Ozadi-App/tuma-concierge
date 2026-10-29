"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "../lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useThemeMode();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      <Icon size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}
