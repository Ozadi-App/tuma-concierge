"use client";

import { Fuel, Moon, Sun, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useThemeMode } from "../lib/theme";

export function BrandHeader() {
  const { attendant, outlet, toggleDuty } = useAuth();
  const { mode, setMode } = useThemeMode();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-faint)] bg-[rgb(var(--surface))]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold text-ink-gold shadow-sm">
            <Fuel className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black tracking-tight text-ink">Peebee</span>
              <span className="rounded-md bg-gold/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold">
                Gas
              </span>
            </div>
            <p className="text-[11px] font-medium text-ink-500 line-clamp-1">
              {outlet?.name ?? "Partner Petrol Station"}
            </p>
          </div>
        </Link>

        {/* Right Actions: Duty Toggle & Theme Switch */}
        <div className="flex items-center gap-2">
          {attendant && (
            <button
              type="button"
              onClick={() => toggleDuty(!attendant.on_duty)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                attendant.on_duty
                  ? "bg-green/15 text-green dark:bg-green/25"
                  : "bg-ink-muted/15 text-ink-500"
              }`}
              title="Toggle On Duty"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  attendant.on_duty ? "bg-green animate-pulse" : "bg-ink-muted"
                }`}
              />
              <span>{attendant.on_duty ? "On Duty" : "Off Duty"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink transition hover:bg-gold/10"
          >
            {mode === "dark" ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
