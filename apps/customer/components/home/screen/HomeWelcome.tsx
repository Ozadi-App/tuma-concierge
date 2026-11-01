"use client";

import { MapPin } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";
import { useTranslate } from "../../../lib/i18n";
import { useLocationLabel } from "../../../lib/use-location-label";

export function HomeWelcome() {
  const { user } = useAuth();
  const t = useTranslate();
  const { label, status } = useLocationLabel();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const location = status === "locating" ? t("locating") : label ?? t("home_location_unavailable");

  return (
    <header className="space-y-3 pt-2">
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink">
        {t("greeting_welcome")}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-base text-ink-500">{t("home_brand_line")}</p>
      <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span className="truncate text-sm font-medium text-ink">{location}</span>
      </p>
    </header>
  );
}
