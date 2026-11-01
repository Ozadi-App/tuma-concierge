"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { HomeCluster, HomeFeature } from "../../../lib/home-catalog";
import { parseHomeVariant, type HomeVariant } from "../../../lib/home-variant";
import { useAuth } from "../../../lib/auth-context";
import { useTranslate } from "../../../lib/i18n";
import { useLocationLabel } from "../../../lib/use-location-label";
import { ArtLink, KampalaScene, Spot, Weave } from "./HomeArt";
import { HomeStatus } from "./HomeSection";

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
  clusters,
  onSelect,
}: {
  start: HomeFeature[];
  clusters: HomeCluster[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, location, t } = useHomeGreeting();
  const [lead, ...rest] = start;
  return (
    <div className="space-y-10">
      <header className="relative -mx-4">
        <KampalaScene className="h-64 w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream/80 to-transparent px-4 pb-3 pt-16">
          <LocationChip location={location} />
          <h1 className="mt-2 text-5xl font-black leading-[0.9] tracking-tight text-ink">
            {firstName ?? t("greeting_welcome")}
          </h1>
          <p className="mt-2 max-w-[16rem] text-base text-ink">{t("home_golden_line")}</p>
        </div>
      </header>
      {lead ? (
        <div className="relative z-[1] -mt-8 space-y-3" data-home-section="start">
          <ArtLink feature={lead} onSelect={onSelect} className="flex min-h-[5.5rem] w-full items-center gap-3 rounded-[28px] bg-gold px-4 py-3 text-left text-ink-gold shadow-[var(--shadow-glow-gold)]">
            <Spot id={lead.id} className="h-16 w-16 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xl font-black leading-tight">{lead.label}</span>
              <span className="block text-sm font-medium opacity-80">{lead.detail}</span>
            </span>
          </ArtLink>
          {rest.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {rest.map((feature) => (
                <ArtLink key={feature.id} feature={feature} onSelect={onSelect} className="flex min-h-28 flex-col items-start justify-between rounded-[22px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card)/0.92)] p-2 text-left shadow-[var(--shadow-card)] backdrop-blur-md">
                  <Spot id={feature.id} className="h-12 w-12" />
                  <span className="text-sm font-bold leading-tight text-ink">{feature.label}</span>
                </ArtLink>
              ))}
            </div>
          )}
        </div>
      ) : (
        <HomeStatus kind="empty" title={t("home_nothing_on")} />
      )}
      <ClusterGroups clusters={clusters} onSelect={onSelect} look="brand" />
    </div>
  );
}

export function LauncherHome({
  start,
  clusters,
  onSelect,
}: {
  start: HomeFeature[];
  clusters: HomeCluster[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, t } = useHomeGreeting();
  const [lead, ...rest] = start;
  const tall = rest[0];
  const stack = rest.slice(1);
  return (
    <div className="space-y-8 pt-1">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-500">{t("home_editorial_line")}</p>
        <h1 className="text-6xl font-black uppercase leading-[0.85] tracking-tight text-ink">
          {firstName ?? t("greeting_welcome")}
        </h1>
      </header>
      {lead ? (
        <div className="grid grid-cols-2 gap-2" data-home-section="start">
          <ArtLink feature={lead} onSelect={onSelect} className="col-span-2 flex min-h-36 items-end justify-between gap-2 overflow-hidden rounded-[28px] bg-ink p-4 text-left text-cream">
            <span>
              <span className="block text-2xl font-black leading-none">{lead.label}</span>
              <span className="mt-1 block max-w-[12rem] text-sm text-cream/80">{lead.detail}</span>
            </span>
            <Spot id={lead.id} className="h-24 w-24 shrink-0 [&_.fill-ink]:fill-cream [&_.stroke-ink]:stroke-cream" />
          </ArtLink>
          {tall && (
            <ArtLink feature={tall} onSelect={onSelect} className="row-span-2 flex min-h-52 flex-col justify-between rounded-[28px] bg-gold p-3 text-left text-ink-gold">
              <Spot id={tall.id} className="h-20 w-20" />
              <span className="text-xl font-black leading-tight">{tall.label}</span>
            </ArtLink>
          )}
          {stack.map((feature) => (
            <ArtLink key={feature.id} feature={feature} onSelect={onSelect} className="flex min-h-24 items-center gap-2 rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-2 text-left shadow-[var(--shadow-card)]">
              <Spot id={feature.id} className="h-14 w-14 shrink-0" />
              <span className="text-base font-black leading-tight text-ink">{feature.label}</span>
            </ArtLink>
          ))}
        </div>
      ) : (
        <HomeStatus kind="empty" title={t("home_nothing_on")} />
      )}
      <ClusterGroups clusters={clusters} onSelect={onSelect} look="launcher" />
    </div>
  );
}

export function TodayHome({
  start,
  clusters,
  onSelect,
}: {
  start: HomeFeature[];
  clusters: HomeCluster[];
  onSelect: (feature: HomeFeature) => void;
}) {
  const { firstName, dayPart, t } = useHomeGreeting();
  const [lead, ...rest] = start;
  return (
    <div className="relative space-y-8 pt-2">
      <Weave id="peebee-page-bark" className="pointer-events-none absolute -inset-x-4 top-0 h-80 w-[calc(100%+2rem)] text-gold opacity-30" />
      <header className="relative">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-ink">{t("home_pattern_line")}</p>
        <h1 className="mt-1 text-5xl font-black leading-[0.9] text-ink">
          {dayPart}
          {firstName ? (
            <span className="relative mt-1 block">
              <span aria-hidden className="absolute -left-1 top-1 h-14 w-14 rounded-full bg-gold/40" />
              <span className="relative text-ink">{firstName}</span>
            </span>
          ) : null}
        </h1>
      </header>
      {lead ? (
        <div className="relative space-y-3" data-home-section="start">
          <ArtLink feature={lead} onSelect={onSelect} className="relative flex min-h-40 items-end overflow-hidden rounded-[40px] bg-ink p-4 text-left text-cream">
            <Weave id="peebee-lead-bark" className="pointer-events-none absolute inset-0 h-full w-full text-gold opacity-40" />
            <span className="relative">
              <span className="block text-2xl font-black leading-none">{lead.label}</span>
              <span className="mt-1 block text-sm text-cream/80">{promptFor(lead, t)}</span>
            </span>
            <Spot id={lead.id} className="relative ml-auto h-24 w-24 shrink-0 [&_.fill-ink]:fill-cream [&_.stroke-ink]:stroke-cream" />
          </ArtLink>
          <div className="flex flex-wrap gap-2">
            {rest.map((feature, index) => (
              <ArtLink
                key={feature.id}
                feature={feature}
                onSelect={onSelect}
                className={`flex min-h-28 w-[calc(50%-4px)] flex-col items-start justify-between rounded-[32px] bg-[rgb(var(--surface-card))] p-3 text-left shadow-[var(--shadow-card)] motion-safe:even:-rotate-2 motion-safe:odd:rotate-1`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/25">
                  <Spot id={feature.id} className="h-12 w-12" />
                </span>
                <span className="text-base font-black text-ink">{feature.label}</span>
              </ArtLink>
            ))}
          </div>
        </div>
      ) : (
        <HomeStatus kind="empty" title={t("home_nothing_on")} />
      )}
      <ClusterGroups clusters={clusters} onSelect={onSelect} look="today" />
    </div>
  );
}

function ClusterGroups({
  clusters,
  onSelect,
  look,
}: {
  clusters: HomeCluster[];
  onSelect: (feature: HomeFeature) => void;
  look: "brand" | "launcher" | "today";
}) {
  if (clusters.length === 0) return null;
  return (
    <div className="space-y-6">
      {clusters.map((cluster) => (
        <section key={cluster.id} data-home-section={`cluster-${cluster.id}`} className="space-y-3">
          <h2 className={look === "launcher" ? "text-5xl font-black uppercase leading-none tracking-tight text-ink" : "text-2xl font-black text-ink"}>{cluster.label}</h2>
          {look === "launcher" ? (
            <div className="flex flex-wrap gap-2">
              {cluster.items.map((feature, index) => (
                <ArtLink key={feature.id} feature={feature} onSelect={onSelect} className={`flex min-h-24 items-end gap-2 rounded-[22px] bg-[rgb(var(--surface-card))] p-2 text-left shadow-[var(--shadow-card)] ${index === 0 ? "w-full" : "w-[calc(50%-4px)]"}`}>
                  <Spot id={feature.id} className="h-14 w-14 shrink-0" />
                  <span className="pb-1 text-base font-black leading-tight text-ink">{feature.label}</span>
                </ArtLink>
              ))}
            </div>
          ) : look === "today" ? (
            <div className="relative overflow-hidden rounded-[32px] bg-[rgb(var(--surface-muted))] p-3">
              <Weave id={`bark-${cluster.id}`} className="pointer-events-none absolute inset-0 h-full w-full text-ink opacity-20" />
              <ul className="relative space-y-2">
                {cluster.items.map((feature) => (
                  <li key={feature.id}>
                    <ArtLink feature={feature} onSelect={onSelect} className="flex min-h-16 items-center gap-3 rounded-full bg-[rgb(var(--surface-card))] px-2 py-1 text-left shadow-[var(--shadow-card)]">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/20">
                        <Spot id={feature.id} className="h-10 w-10" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-black text-ink">{feature.label}</span>
                        <span className="block truncate text-sm text-ink-500">{feature.detail}</span>
                      </span>
                    </ArtLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
                {cluster.items.map((feature) => (
                  <ArtLink key={feature.id} feature={feature} onSelect={onSelect} className="flex h-36 w-28 shrink-0 flex-col items-start justify-between rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card)/0.9)] p-3 text-left shadow-[var(--shadow-card)] backdrop-blur-md">
                    <Spot id={feature.id} className="h-14 w-14" />
                    <span className="text-sm font-black leading-tight text-ink">{feature.label}</span>
                  </ArtLink>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
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
