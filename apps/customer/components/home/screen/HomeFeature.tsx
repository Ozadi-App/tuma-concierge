"use client";

import Link from "next/link";
import type { HomeFeature } from "../../../lib/home-catalog";
import { HOME_FEATURE_ICON } from "./home-icons";

const iconWrap = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--surface-muted))] text-ink";

export function HomeTile({ feature, onSelect }: { feature: HomeFeature; onSelect: (feature: HomeFeature) => void }) {
  const Icon = HOME_FEATURE_ICON[feature.id];
  const className =
    "flex min-h-44 w-full flex-col items-start gap-3 rounded-[var(--radius-card)] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 text-left shadow-[var(--shadow-card)]";
  const body = (
    <>
      <span className={iconWrap}>
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold leading-tight text-ink">{feature.label}</span>
        <span className="mt-1 block text-sm leading-snug text-ink-500">{feature.detail}</span>
      </span>
    </>
  );
  if (feature.href) {
    return (
      <Link href={feature.href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(feature)} className={className}>
      {body}
    </button>
  );
}

export function HomeFeatureRow({ feature, onSelect }: { feature: HomeFeature; onSelect: (feature: HomeFeature) => void }) {
  const Icon = HOME_FEATURE_ICON[feature.id];
  const className = "flex min-h-12 w-full items-center gap-3 py-2 text-left";
  const body = (
    <>
      <span className={iconWrap}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{feature.label}</span>
      <span aria-hidden className="text-lg leading-none text-ink-500">
        ›
      </span>
    </>
  );
  if (feature.href) {
    return (
      <Link href={feature.href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(feature)} className={className}>
      {body}
    </button>
  );
}
