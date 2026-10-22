"use client";
import { foodBusinessLabel, type ColourScene, type MenuItem, type Restaurant, type RestaurantMenu } from "@peebee/shared";
import { storefrontStyle, type StorefrontMode } from "@peebee/shared/storefront-palette";
import { ChevronLeft, Clock, MapPin, Minus, Plus, Search, ShoppingBag, Star, Store, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api } from "../../lib/api";
import { FeaturedDishCard, GeneralDishCard, menuItemPricing, useDishPhoto } from "./DishCards";

export type PreviewScreen = "storefront" | "dish" | "cart";
const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

function useCover(r: Restaurant) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!r.cover_key) { setUrl(null); return; }
    let off = false, u: string | null = null;
    api.restaurantCoverBlob(r.id, r.cover_key).then((b) => { if (off) return; u = URL.createObjectURL(b); setUrl(u); }).catch(() => {});
    return () => { off = true; if (u) URL.revokeObjectURL(u); };
  }, [r.id, r.cover_key]);
  return url;
}

/** A phone-sized, display-only render of the customer storefront in the business's own palette. */
export function StorefrontPreview({ restaurant, menu, scene, mode, screen, onScreen }: {
  restaurant: Restaurant; menu: RestaurantMenu; scene: ColourScene; mode: StorefrontMode; screen: PreviewScreen; onScreen: (s: PreviewScreen, item?: MenuItem) => void;
}) {
  const sections = useMemo(() => [...menu.categories.map((c) => ({ id: c.id, name: c.name, items: c.items })), { id: "none", name: "More", items: menu.uncategorizedItems }].filter((s) => s.items.length), [menu]);
  const all = sections.flatMap((s) => s.items);
  const featured = all.filter((i) => i.is_featured);
  const [tab, setTab] = useState("all");
  const [dish, setDish] = useState<MenuItem | null>(null);
  const open = (item: MenuItem) => { setDish(item); onScreen("dish", item); };
  const current = dish ?? featured[0] ?? all[0] ?? null;
  const cover = useCover(restaurant);
  const isOpen = !!restaurant.is_open && restaurant.status === "active";
  const cart = all.filter((i) => i.available === 1).slice(0, 2);
  const itemsTotal = cart.reduce((s, i) => s + menuItemPricing(i).price, 0);

  return (
    <div className="sf-phone">
      <div className="sf-frame" data-sf-mode={mode} style={storefrontStyle(scene, mode) as CSSProperties}>
        <div className="sf-status" aria-hidden><span>9:41</span><span className="sf-notch" /><span>5G ▮</span></div>
        <div className="sf-scroll">
          {screen === "storefront" && (
            <>
              <div className="sf-hero">
                {cover ? <img src={cover} alt="" /> : <span className="sf-hero-empty"><Store size={48} /></span>}
                <span className="sf-hero-shade" />
                <span className="sf-hero-top"><span className="sf-round"><ChevronLeft size={20} /></span><span className="sf-round"><Search size={17} /></span></span>
                <span className="sf-hero-copy">
                  <span className="sf-chip-open" data-open={isOpen}>{isOpen ? "Open now" : "Closed"}</span>
                  <span className="sf-hero-name">{restaurant.name}</span>
                  <span className="sf-hero-sub">{foodBusinessLabel(restaurant.business_type)}{restaurant.cuisine ? ` · ${restaurant.cuisine}` : ""}</span>
                </span>
              </div>
              <div className="sf-stats">
                <span><Star size={14} /> New</span>
                <span><Clock size={14} /> {restaurant.open_time && restaurant.close_time ? `${restaurant.open_time}–${restaurant.close_time}` : "Hours vary"}</span>
                <span><MapPin size={14} /> {restaurant.address ?? "Pickup set"}</span>
              </div>
              {restaurant.description && <p className="sf-desc">{restaurant.description}</p>}
              <div className="sf-tabs" role="tablist" aria-label="Menu sections">
                {[{ id: "all", name: "All" }, ...sections].map((s) => <button key={s.id} type="button" role="tab" aria-selected={tab === s.id} onClick={() => setTab(s.id)}>{s.name}</button>)}
              </div>
              {featured.length > 0 && tab === "all" && (
                <section className="sf-section">
                  <div className="sf-section-head"><h2>Featured</h2><span>Selected by the kitchen</span></div>
                  <div className="sf-rail">{featured.map((i) => <FeaturedDishCard key={i.id} item={i} restaurantOpen={isOpen} onOpen={() => open(i)} />)}</div>
                </section>
              )}
              {sections.filter((s) => tab === "all" || s.id === tab).map((s) => (
                <section key={s.id} className="sf-section">
                  <p className="fc-section__title">{s.name}</p>
                  <div className="fc-grid">{s.items.map((i) => <GeneralDishCard key={i.id} item={i} restaurantOpen={isOpen} onOpen={() => open(i)} />)}</div>
                </section>
              ))}
              {!all.length && <p className="sf-empty"><UtensilsCrossed size={28} /> Add dishes to your menu and they appear here.</p>}
              <div className="sf-cartbar-space" />
            </>
          )}
          {screen === "dish" && current && <DishScreen item={current} isOpen={isOpen} onBack={() => onScreen("storefront")} />}
          {screen === "cart" && (
            <div className="sf-cart">
              <div className="sf-flow-head"><button type="button" className="sf-round" onClick={() => onScreen("storefront")} aria-label="Back"><ChevronLeft size={20} /></button><span><b>Your order</b><small>{restaurant.name}</small></span></div>
              <div className="sf-steps" aria-hidden><span className="is-on">Cart</span><span>Delivery</span><span>Pay</span></div>
              {cart.map((i) => <CartLine key={i.id} item={i} />)}
              <div className="sf-summary">
                <span><span>Food</span><span>{ugx(itemsTotal)}</span></span>
                <span><span>Delivery</span><span>{ugx(4000)}</span></span>
                <span className="is-total"><span>Total</span><span>{ugx(itemsTotal + 4000)}</span></span>
              </div>
              <button type="button" className="sf-next">Continue to delivery</button>
              <button type="button" className="sf-pay">Pay {ugx(itemsTotal + 4000)}</button>
              <p className="sf-note">Preview only. Peebee Pay stays gold for every business.</p>
            </div>
          )}
        </div>
        {screen === "storefront" && cart.length > 0 && (
          <button type="button" className="sf-cartbar" onClick={() => onScreen("cart")}><ShoppingBag size={18} /><span>View cart · {cart.length} items</span><b>{ugx(itemsTotal)}</b></button>
        )}
      </div>
    </div>
  );
}

function CartLine({ item }: { item: MenuItem }) {
  const url = useDishPhoto(item);
  return (
    <div className="sf-line">
      <span className="sf-line-photo">{url ? <img src={url} alt="" /> : <UtensilsCrossed size={18} />}</span>
      <span className="min-w-0 flex-1"><b>{item.name}</b><small>{ugx(menuItemPricing(item).price)}</small></span>
      <span className="sf-qty"><Minus size={14} /><b>1</b><Plus size={14} /></span>
    </div>
  );
}

function DishScreen({ item, isOpen, onBack }: { item: MenuItem; isOpen: boolean; onBack: () => void }) {
  const url = useDishPhoto(item);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const extra = item.options.flatMap((o) => o.choices.filter((c) => (picked[o.id] ?? []).includes(c.id))).reduce((s, c) => s + c.price_delta, 0);
  return (
    <div className="sf-dish">
      <div className="sf-dish-photo">{url ? <img src={url} alt="" /> : <UtensilsCrossed size={48} />}<button type="button" className="sf-round sf-dish-back" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button>
        {item.prep_time_minutes ? <span className="fc-glass-pill sf-dish-prep"><Clock size={13} />{item.prep_time_minutes} min</span> : null}</div>
      <div className="sf-dish-body">
        <h2>{item.name}</h2>
        {item.description && <p>{item.description}</p>}
        <span className="sf-dish-price">{ugx(item.price + extra)}</span>
        {item.options.map((o) => (
          <fieldset key={o.id} className="sf-opt">
            <legend>{o.name} <small>{o.required ? "Required" : "Optional"} · {o.multi_select ? "Choose any" : "Choose one"}</small></legend>
            {o.choices.map((c) => {
              const on = (picked[o.id] ?? []).includes(c.id);
              return (
                <button type="button" key={c.id} className="sf-choice" aria-pressed={on} onClick={() => setPicked((p) => ({ ...p, [o.id]: o.multi_select ? (on ? (p[o.id] ?? []).filter((x) => x !== c.id) : [...(p[o.id] ?? []), c.id]) : [c.id] }))}>
                  <span className={o.multi_select ? "sf-box" : "sf-dot"} aria-hidden />{c.name}<small>{c.price_delta ? `+${ugx(c.price_delta)}` : ""}</small>
                </button>
              );
            })}
          </fieldset>
        ))}
        <button type="button" className="sf-next" disabled={!isOpen || item.available !== 1}>{item.available !== 1 ? "Sold out" : !isOpen ? "Closed now" : `Add to cart · ${ugx(item.price + extra)}`}</button>
      </div>
    </div>
  );
}
