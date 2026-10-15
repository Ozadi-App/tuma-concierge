"use client";

/**
 * Presentation-only building blocks for the marketplace screens
 * (groceries, stores, product detail, cart). Light, airy surfaces, large
 * rounded corners and soft shadows, using Peebee's existing colour tokens
 * only (gold is the accent; no new colours are introduced).
 */
import { MapPin, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth-context";
import { useLocationLabel } from "../../lib/use-location-label";
import { ProductImage } from "../ProductImage";

export const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

/** Soft card surface shared by the marketplace screens. */
export const softCard =
  "rounded-[24px] bg-[rgb(var(--surface-card))] shadow-[var(--shadow-card)] border border-[var(--border-faint)]";

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Greeting + current location, with an avatar on the left and an optional action on the right. */
export function MarketGreetingHeader({ trailing }: { trailing?: ReactNode }) {
  const { user } = useAuth();
  const { label, status } = useLocationLabel();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const location = status === "locating" ? "Locating…" : label ?? "Kampala";
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        href="/account"
        aria-label="Your account"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-sm font-bold text-ink shadow-[var(--shadow-card)]"
      >
        {initials(user?.name)}
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs font-medium text-ink-500">Hello{firstName ? `, ${firstName}` : ""}</p>
        <p className="mt-0.5 flex items-center justify-center gap-1 truncate text-sm font-bold text-ink">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden />
          <span className="truncate">{location}</span>
        </p>
      </div>
      <div className="flex h-11 min-w-11 shrink-0 items-center justify-end">{trailing}</div>
    </header>
  );
}

/** Rounded search field with a square-ish filter button beside it. */
export function MarketSearchBar({
  value,
  onChange,
  placeholder,
  filtersOpen,
  onToggleFilters,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative flex-1">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-[20px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] pl-11 pr-10 text-sm text-ink shadow-[var(--shadow-card)] placeholder:text-ink-500/70 focus:border-gold focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>
      <button
        type="button"
        onClick={onToggleFilters}
        aria-label={filtersOpen ? "Hide categories" : "Show categories"}
        aria-expanded={filtersOpen}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-95"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

/** Rounded promotional card in the brand accent. */
export function PromoBanner({ eyebrow, title, body, icon }: { eyebrow: string; title: string; body: string; icon?: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="relative overflow-hidden rounded-[24px] bg-gold px-5 py-5 text-ink-gold shadow-[var(--shadow-glow-gold)]"
    >
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/20" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold leading-tight">{title}</h2>
          <p className="mt-1 text-xs leading-snug opacity-80">{body}</p>
        </div>
        {icon && (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-white/25">{icon}</div>
        )}
      </div>
    </section>
  );
}

/** Horizontal pill chips; the active one uses the brand accent. */
export function CategoryChips({ items, active, onSelect }: { items: string[]; active: string; onSelect: (item: string) => void }) {
  return (
    <div role="tablist" aria-label="Categories" className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1">
      {items.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95 ${
              isActive
                ? "bg-gold text-ink-gold shadow-[var(--shadow-glow-gold)]"
                : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

export type MarketProduct = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  badge?: string | null;
  image_url?: string | null;
  category_name?: string | null;
};

/** Rounded image card: tap the image/name for detail, round button adds to cart. */
export function MarketProductCard({ product, fallbackCategory, onAdd }: { product: MarketProduct; fallbackCategory?: string; onAdd: () => void }) {
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  return (
    <article className="flex flex-col">
      <Link href={`/product/${product.id}`} className="group block">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-[rgb(var(--surface-muted))] shadow-[var(--shadow-card)]">
          <ProductImage
            src={product.image_url}
            alt={product.title}
            category={product.category_name || fallbackCategory}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {product.badge && (
            <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[rgb(var(--surface-card)/.92)] px-2.5 py-1 text-[10px] font-semibold text-ink shadow-sm">
              {product.badge}
            </span>
          )}
          {onSale && (
            <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              Sale
            </span>
          )}
        </div>
      </Link>
      <div className="mt-2.5 flex items-start justify-between gap-2 px-1">
        <Link href={`/product/${product.id}`} className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-semibold text-ink">{product.title}</h3>
          <p className="mt-0.5 text-xs font-medium text-ink-500">
            <span className="text-ink">{ugx(product.price)}</span>
            {onSale && <span className="ml-1 text-[10px] line-through">{ugx(product.compare_at_price!)}</span>}
          </p>
        </Link>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${product.title} to cart`}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}

/** Rounded checkbox used in the cart. */
export function RoundCheck({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border transition ${
        checked ? "border-gold bg-gold text-ink-gold" : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.5} aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
