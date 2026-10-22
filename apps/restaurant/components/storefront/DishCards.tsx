"use client";
/* Customer food card components, mirrored from apps/customer/app/restaurants/[id]/page.tsx
 * (FeaturedDishCard / GeneralDishCard) so the Preview shows dishes exactly as customers see them.
 * Display-only: Add pills don't order anything here. */
import type { MenuItem, MenuItemBadge } from "@peebee/shared";
import { BadgeCheck, Clock, Plus, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const DISH_BADGE_LABEL: Record<MenuItemBadge, string> = { trending: "Popular", new: "New", sale: "Offer" };

export function menuItemPricing(item: Pick<MenuItem, "price" | "options">) {
  let price = Number(item.price), from = false;
  for (const option of item.options ?? []) {
    if (!option.required) continue;
    const deltas = option.choices.map((c) => Number(c.price_delta)).filter(Number.isFinite);
    if (!deltas.length) continue;
    price += Math.min(...deltas);
    if (new Set(deltas).size > 1) from = true;
  }
  return { price, from };
}

export function useDishPhoto(item: MenuItem) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item.photo_key) { setUrl(null); return; }
    let cancelled = false, objectUrl: string | null = null;
    api.menuItemPhotoBlob(item.id).then((blob) => { if (cancelled || !blob.type.startsWith("image/")) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, item.photo_key, item.updated_at]);
  return url;
}

export type DishCardProps = { item: MenuItem; restaurantOpen: boolean; onOpen: () => void };

function DishPrice({ item }: { item: MenuItem }) {
  const p = menuItemPricing(item);
  return <span className="fc-price">{p.from && <span className="fc-price__from">from</span>}<span className="fc-price__ccy">UGX</span><span className="fc-price__amount">{p.price.toLocaleString("en-UG")}</span></span>;
}
function DishAdd({ item, restaurantOpen, onOpen }: DishCardProps) {
  const soldOut = item.available !== 1;
  if (!restaurantOpen || soldOut) return <button type="button" className="fc-add" disabled>{soldOut ? "Sold out" : "Closed"}</button>;
  return <button type="button" className="fc-add" onClick={onOpen} aria-label={`Preview ${item.name}`}><span>Add</span><Plus size={15} strokeWidth={2.4} aria-hidden /></button>;
}
const Badge = ({ label, corner }: { label: string; corner: "left" | "right" }) => <span className={`fc-badge fc-overlay fc-overlay--${corner}`}><BadgeCheck size={12} strokeWidth={2.4} aria-hidden />{label}</span>;

/** Featured: full photo, frosted base, badge top-right, prep top-left. */
export function FeaturedDishCard(props: DishCardProps) {
  const { item, onOpen } = props;
  const url = useDishPhoto(item);
  return (
    <article className="fc-card fc-card--featured">
      <button type="button" className="fc-hit" onClick={onOpen} aria-label={`View ${item.name}`} />
      <span className={`fc-feature__media ${url ? "" : "is-empty"}`} aria-hidden>
        {url ? <img src={url} alt="" /> : <UtensilsCrossed size={44} />}
        <span className="fc-feature__blur" /><span className="fc-feature__tint" />
      </span>
      {item.prep_time_minutes ? <span className="fc-glass-pill fc-overlay fc-overlay--left"><Clock size={13} aria-hidden />{item.prep_time_minutes} min</span> : null}
      <Badge label={item.badge ? DISH_BADGE_LABEL[item.badge] : "Chef's pick"} corner="right" />
      <span className="fc-feature__body">
        <h3 className="fc-name" title={item.name}>{item.name}</h3>
        {item.description && <span className="fc-desc">{item.description}</span>}
        <span className="fc-row"><span className="fc-feature__left"><DishPrice item={item} /></span><DishAdd {...props} /></span>
      </span>
    </article>
  );
}

/** General: rounded-square photo, badge top-left, one-line title, prep in the bottom row. */
export function GeneralDishCard(props: DishCardProps) {
  const { item, onOpen } = props;
  const url = useDishPhoto(item);
  return (
    <article className="fc-card fc-card--general">
      <button type="button" className="fc-hit" onClick={onOpen} aria-label={`View ${item.name}`} />
      <span className={`fc-general__media ${url ? "" : "is-empty"}`}>
        {url ? <img src={url} alt="" /> : <UtensilsCrossed size={34} />}
        {item.badge && <Badge label={DISH_BADGE_LABEL[item.badge]} corner="left" />}
      </span>
      <span className="fc-general__body">
        <h3 className="fc-name" title={item.name}>{item.name}</h3>
        {item.description && <span className="fc-desc">{item.description}</span>}
        <DishPrice item={item} />
        <span className="fc-row">
          <span className="fc-meta">{item.prep_time_minutes ? <span className="fc-meta__item"><Clock size={13} aria-hidden />{item.prep_time_minutes} min</span> : null}</span>
          <DishAdd {...props} />
        </span>
      </span>
    </article>
  );
}
