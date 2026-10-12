"use client";

import {
  Building2,
  ChevronDown,
  Fuel,
  LogOut,
  Moon,
  Power,
  Sun,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { useResolvedTheme, useThemeMode } from "../lib/theme";
import { BrandLogo } from "./BrandLogo";
import { Select } from "@peebee/shared/select";

const THEME_OPTIONS = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
] as const;

export function BrandHeader() {
  const { attendant, outlet, outlets, selectOutlet, toggleDuty, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setMode } = useThemeMode();
  const activeTheme = useResolvedTheme();
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setExpanded(false), [pathname]);

  const isDarkMode = activeTheme === "dark";

  return (
    <header
      className="customer-header sticky top-0 z-40 transition-colors"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setExpanded(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4">
        {/* Peebee Gas Logo with customer app branding */}
        <Link
          href="/"
          aria-label="Peebee Gas Home"
          className="flex shrink-0 items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
        >
          <BrandLogo variant={isDarkMode ? "dark" : "light"} />
          <sup
            aria-hidden="true"
            className={`pt-1 text-[10px] font-black uppercase tracking-widest ${
              isDarkMode ? "text-black" : "text-gold"
            }`}
          >
            Gas
          </sup>
        </Link>

        {/* Attendant quick status & Profile expand toggle */}
        <div className="flex items-center gap-2">
          {attendant && (
            <button
              type="button"
              onClick={() => toggleDuty(!attendant.on_duty)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                attendant.on_duty
                  ? isDarkMode
                    ? "bg-black/15 text-black font-extrabold"
                    : "bg-green/20 text-green-400"
                  : isDarkMode
                    ? "bg-black/10 text-black/60"
                    : "bg-white/10 text-white/60"
              }`}
              title="Toggle duty state"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  attendant.on_duty
                    ? isDarkMode
                      ? "bg-black animate-pulse"
                      : "bg-green-400 animate-pulse"
                    : "bg-white/40"
                }`}
              />
              <span>{attendant.on_duty ? "On Duty" : "Off Duty"}</span>
            </button>
          )}

          <button
            ref={toggleRef}
            type="button"
            aria-label={expanded ? "Close station menu" : "Open station menu"}
            aria-expanded={expanded}
            aria-controls="header-profile"
            onClick={() => setExpanded((v) => !v)}
            className="customer-header-toggle flex h-10 w-10 items-center justify-center rounded-full"
          >
            <ChevronDown
              size={20}
              className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Accordion Profile & Station Drawer */}
      <div
        id="header-profile"
        className={`customer-profile-reveal mx-auto grid max-w-lg ${expanded ? "is-expanded" : ""}`}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 px-4 pb-4">
            {/* Attendant Card */}
            {attendant ? (
              <div className="customer-profile-card flex items-center justify-between gap-3 rounded-3xl p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="customer-profile-avatar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold">
                    <User size={22} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-base font-bold leading-tight">
                      {attendant.name}
                    </span>
                    <span className="customer-profile-muted mt-0.5 block truncate text-xs">
                      {attendant.code} · {outlet?.name ?? "Petrol Station"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleDuty(!attendant.on_duty)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    attendant.on_duty
                      ? "bg-green text-white"
                      : isDarkMode
                        ? "bg-black/20 text-black"
                        : "bg-white/10 text-white/80"
                  }`}
                >
                  <Power size={13} />
                  <span>{attendant.on_duty ? "Active" : "Paused"}</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setExpanded(false)}
                className="customer-profile-card flex items-center justify-between rounded-3xl p-4 font-bold"
              >
                <span>Attendant Sign In</span>
                <span className="text-xs uppercase tracking-wider text-gold">Login &rarr;</span>
              </Link>
            )}

            {/* Station Outlets Selector */}
            {outlets.length > 1 && (
              <div className="customer-profile-appearance rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={14} className="opacity-70" />
                  <span className="customer-profile-muted text-xs font-semibold">
                    Station Outlet
                  </span>
                </div>
                <Select
                  value={outlet?.id ?? ""}
                  onValueChange={(val) => {
                    selectOutlet(val);
                    setExpanded(false);
                  }}
                  aria-label="Station Outlet"
                  sizing="stretch"
                  className="w-full text-xs font-bold"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Appearance Theme Selector */}
            <section
              className="customer-profile-appearance rounded-2xl px-3 py-3"
              aria-label="Appearance"
            >
              <h2 className="customer-profile-muted mb-2 text-xs font-semibold">Appearance</h2>
              <div
                className="customer-profile-segmented grid grid-cols-2 gap-1 rounded-full p-1"
                role="group"
                aria-label="Color theme"
              >
                {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }) => {
                  const selected = activeTheme === optionMode;
                  return (
                    <button
                      key={optionMode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setMode(optionMode)}
                      className={`customer-profile-theme-option flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-bold transition-colors ${
                        selected ? "is-selected shadow-sm" : ""
                      }`}
                    >
                      <Icon size={15} strokeWidth={2} aria-hidden />
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Sign out */}
            {attendant && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setExpanded(false);
                  router.push("/login");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-500/20"
              >
                <LogOut size={14} />
                <span>Sign Out Attendant</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
