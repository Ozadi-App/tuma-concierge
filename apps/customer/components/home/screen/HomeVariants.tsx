"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { HomeFeature } from "../../../lib/home-catalog";
import { parseHomeVariant, type HomeVariant } from "../../../lib/home-variant";
import { useAuth } from "../../../lib/auth-context";
import { useTranslate } from "../../../lib/i18n";
import { useLocationLabel } from "../../../lib/use-location-label";
import { HomeFeatureFace, HomeFeatureRow, HomePrimaryAction } from "./HomeFeature";
import { HomeSection, HomeStatus } from "./HomeSection";

export function useHomeVariant(): { variant: HomeVariant; reviewing: boolean } {
  const [variant, setVariant] = useState<HomeVariant>("a");
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setReviewing(params.has("homeVariant"));
      setVariant(parseHomeVariant(params.get("homeVariant")));
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  return { variant, reviewing };
}

export function useHomeGreeting() {
  const { user } = useAuth();
  const t = useTranslate();
  const { label, status } = useLocationLabel();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const location = status === "locating" ? t("locating") : label ?? t("home_location_unavailable");
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? t("greeting_morning") : hour < 17 ? t("greeting_afternoon") : t("greeting_evening");
  return { firstName, location, dayPart, t };
}

export function LocationChip({ location }: { location: string }) {
  return (
    <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-[rgb(var(--surface-card)/0.8)] px-3 py-2">
      <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden />
      <span className="truncate text-sm font-medium text-ink">{location}</span>
    </p>
  );
}

function promptFor(feature: HomeFeature, t: ReturnType<typeof useTranslate>) {
  if (feature.id === "shopping-list") return t("home_ready_list");
  if (feature.id === "boda") return t("home_ready_boda");
  if (feature.id === "food") return t("home_ready_food");
  if (feature.id === "parcel") return t("home_ready_parcel");
  return t("home_ready_generic", { name: feature.label });
}

export function BrandHome({
  start,
  more,
  onSelect,
}: {
  start: HomeFeature[];
  more: HomeFeature[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, location, t } = useHomeGreeting();
  const [lead, ...rest] = start;
  return (
    <div className="space-y-8">
      <header className="relative -mx-4 overflow-hidden px-4 pb-6 pt-3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgb(var(--color-gold)/0.55),transparent_58%),radial-gradient(ellipse_at_92%_18%,rgb(var(--color-gold)/0.22),transparent_46%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -right-10 top-6 h-44 w-44 rounded-[60%_40%_55%_45%] bg-gold/25" />
        <div aria-hidden className="pointer-events-none absolute -left-16 bottom-0 h-28 w-40 rounded-[50%_50%_40%_60%] bg-gold/15" />
        <div className="relative space-y-5">
          <div className="space-y-3">
            <LocationChip location={location} />
            <h1 className="max-w-[16rem] text-4xl font-bold leading-[1.05] tracking-tight text-ink">
              {t("greeting_welcome")}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="max-w-[18rem] text-lg text-ink-500">{t("home_brand_line")}</p>
          </div>
          {lead ? (
            <div className="space-y-3">
              <HomePrimaryAction feature={lead} onSelect={onSelect} />
              {rest.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {rest.map((feature) => (
                    <HomeFeatureFace key={feature.id} feature={feature} onSelect={onSelect} look="overlap" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <HomeStatus kind="empty" title={t("home_nothing_on")} />
          )}
        </div>
      </header>
      <AlsoList more={more} onSelect={onSelect} />
    </div>
  );
}

export function LauncherHome({
  start,
  more,
  onSelect,
}: {
  start: HomeFeature[];
  more: HomeFeature[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, location, t } = useHomeGreeting();
  return (
    <div className="space-y-6 pt-2">
      <header className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold leading-tight text-ink">
          {t("greeting_welcome")}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="max-w-[46%] truncate text-right text-sm font-medium text-ink-500">{location}</p>
      </header>
      {start.length === 0 ? (
        <HomeStatus kind="empty" title={t("home_nothing_on")} />
      ) : (
        <div className="grid grid-cols-2 gap-3" data-home-section="start">
          {start.map((feature) => (
            <HomeFeatureFace key={feature.id} feature={feature} onSelect={onSelect} look="launcher" />
          ))}
        </div>
      )}
      {more.length > 0 && (
        <HomeSection title={t("home_also")} sectionId="also">
          <div className="grid grid-cols-4 gap-1">
            {more.map((feature) => (
              <HomeFeatureFace key={feature.id} feature={feature} onSelect={onSelect} look="cell" />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  );
}

export function TodayHome({
  start,
  more,
  onSelect,
}: {
  start: HomeFeature[];
  more: HomeFeature[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, location, dayPart, t } = useHomeGreeting();
  const [lead, ...rest] = start;
  return (
    <div className="space-y-8 pt-3">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">{location}</p>
        <h1 className="text-3xl font-bold leading-tight text-ink">
          {dayPart}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>
      {lead ? (
        <div className="space-y-4" data-home-section="start">
          <article className="rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-[var(--shadow-card)]">
            <p className="text-sm font-semibold text-ink">{t("home_brand_line")}</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-ink">{promptFor(lead, t)}</h2>
            <p className="mt-1 text-base text-ink-500">{lead.detail}</p>
            <div className="mt-4">
              <HomePrimaryAction feature={lead} onSelect={onSelect} />
            </div>
          </article>
          {rest.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink-500">{t("home_or_else")}</h2>
              <div className="edge-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                {rest.map((feature) => (
                  <div key={feature.id} className="w-[78%] shrink-0 snap-start">
                    <HomeFeatureFace feature={feature} onSelect={onSelect} look="story" actionLabel={t("home_open")} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <HomeStatus kind="empty" title={t("home_nothing_on")} />
      )}
      <AlsoList more={more} onSelect={onSelect} />
    </div>
  );
}

function AlsoList({ more, onSelect }: { more: HomeFeature[]; onSelect: (feature: HomeFeature) => void }) {
  const t = useTranslate();
  if (more.length === 0) return null;
  return (
    <HomeSection title={t("home_also")} sectionId="also">
      <ul className="divide-y divide-[var(--border-faint)]">
        {more.map((feature) => (
          <li key={feature.id}>
            <HomeFeatureRow feature={feature} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}

export function HomeVariantSwitch({ current }: { current: HomeVariant }) {
  const t = useTranslate();
  const options: { id: HomeVariant; label: string }[] = [
    { id: "a", label: t("home_variant_brand") },
    { id: "b", label: t("home_variant_launcher") },
    { id: "c", label: t("home_variant_today") },
  ];
  return (
    <nav aria-label={t("home_design_preview")} className="space-y-2 rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t("home_design_preview")}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <a
            key={option.id}
            href={`/?homeVariant=${option.id}`}
            aria-current={option.id === current ? "true" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-bold ${
              option.id === current ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-card))] text-ink"
            }`}
          >
            {option.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
