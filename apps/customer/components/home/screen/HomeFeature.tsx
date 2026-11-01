"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { HomeFeature } from "../../../lib/home-catalog";
import { HOME_FEATURE_ICON } from "./home-icons";

export type HomeFeatureLook = "tile" | "overlap" | "launcher" | "cell" | "story" | "strip";

function FeatureControl({
  feature,
  onSelect,
  className,
  children,
}: {
  feature: HomeFeature;
  onSelect: (feature: HomeFeature) => void;
  className: string;
  children: ReactNode;
}) {
  if (feature.href) {
    return (
      <Link href={feature.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(feature)} className={className}>
      {children}
    </button>
  );
}

const iconWrap = "flex shrink-0 items-center justify-center bg-[rgb(var(--surface-muted))] text-ink";

export function HomeFeatureFace({
  feature,
  onSelect,
  look,
  actionLabel,
}: {
  feature: HomeFeature;
  onSelect: (feature: HomeFeature) => void;
  look: HomeFeatureLook;
  actionLabel?: string;
}) {
  const Icon = HOME_FEATURE_ICON[feature.id];
  if (look === "launcher") {
    return (
      <FeatureControl
        feature={feature}
        onSelect={onSelect}
        className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-4 text-center shadow-[var(--shadow-card)]"
      >
        <span className={`${iconWrap} h-16 w-16 rounded-[22px]`}>
          <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="text-base font-bold leading-tight text-ink">{feature.label}</span>
      </FeatureControl>
    );
  }
  if (look === "cell") {
    return (
      <FeatureControl
        feature={feature}
        onSelect={onSelect}
        className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2 text-center"
      >
        <span className={`${iconWrap} h-11 w-11 rounded-2xl`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="line-clamp-2 text-sm font-semibold leading-tight text-ink">{feature.label}</span>
      </FeatureControl>
    );
  }
  if (look === "overlap") {
    return (
      <FeatureControl
        feature={feature}
        onSelect={onSelect}
        className="flex min-h-28 flex-col items-start justify-between rounded-[22px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card)/0.92)] p-3 text-left shadow-[var(--shadow-card)] backdrop-blur-md"
      >
        <span className={`${iconWrap} h-10 w-10 rounded-xl`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="text-sm font-bold leading-tight text-ink">{feature.label}</span>
      </FeatureControl>
    );
  }
  if (look === "strip") {
    return (
      <FeatureControl
        feature={feature}
        onSelect={onSelect}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2 text-left shadow-[var(--shadow-card)]"
      >
        <span className={`${iconWrap} h-11 w-11 rounded-2xl`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold leading-tight text-ink">{feature.label}</span>
          <span className="block truncate text-sm leading-snug text-ink-500">{feature.detail}</span>
        </span>
      </FeatureControl>
    );
  }
  if (look === "story") {
    return (
      <FeatureControl
        feature={feature}
        onSelect={onSelect}
        className="flex min-h-52 w-full flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 text-left shadow-[var(--shadow-card)]"
      >
        <span>
          <span className={`${iconWrap} h-12 w-12 rounded-2xl`}>
            <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="mt-4 block text-xl font-bold leading-tight text-ink">{feature.label}</span>
          <span className="mt-1 block text-sm leading-snug text-ink-500">{feature.detail}</span>
        </span>
        {actionLabel && <span className="mt-4 inline-flex min-h-11 items-center text-base font-bold text-ink">{actionLabel}</span>}
      </FeatureControl>
    );
  }
  return (
    <FeatureControl
      feature={feature}
      onSelect={onSelect}
      className="flex min-h-44 w-full flex-col items-start gap-3 rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 text-left shadow-[var(--shadow-card)]"
    >
      <span className={`${iconWrap} h-11 w-11 rounded-2xl`}>
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold leading-tight text-ink">{feature.label}</span>
        <span className="mt-1 block text-sm leading-snug text-ink-500">{feature.detail}</span>
      </span>
    </FeatureControl>
  );
}

export function HomeTile({ feature, onSelect }: { feature: HomeFeature; onSelect: (feature: HomeFeature) => void }) {
  return <HomeFeatureFace feature={feature} onSelect={onSelect} look="tile" />;
}

export function HomeFeatureRow({ feature, onSelect }: { feature: HomeFeature; onSelect: (feature: HomeFeature) => void }) {
  const Icon = HOME_FEATURE_ICON[feature.id];
  return (
    <FeatureControl feature={feature} onSelect={onSelect} className="flex min-h-12 w-full items-center gap-3 py-2 text-left">
      <span className={`${iconWrap} h-11 w-11 rounded-2xl`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{feature.label}</span>
      <span aria-hidden className="text-lg leading-none text-ink-500">
        ›
      </span>
    </FeatureControl>
  );
}

/** The one gold action on the brand home. */
export function HomePrimaryAction({ feature, onSelect }: { feature: HomeFeature; onSelect: (feature: HomeFeature) => void }) {
  const Icon = HOME_FEATURE_ICON[feature.id];
  return (
    <FeatureControl
      feature={feature}
      onSelect={onSelect}
      className="flex min-h-14 w-full items-center gap-3 rounded-full bg-gold px-4 py-2 text-left text-ink-gold shadow-[var(--shadow-glow-gold)]"
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold leading-tight">{feature.label}</span>
        <span className="block truncate text-sm font-medium opacity-80">{feature.detail}</span>
      </span>
    </FeatureControl>
  );
}
