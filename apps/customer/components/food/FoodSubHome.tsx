"use client";
/* eslint-disable @next/next/no-img-element -- blob/demo photos, same as the restaurant page */

import { FOOD_BUSINESS_TYPES, foodBusinessLabel, type FoodBusinessType, type MenuItem, type MenuItemBadge, type Restaurant, type RestaurantMenu } from "@peebee/shared";
import { demoFoodPhotoPath, demoRestaurantPhotoPath } from "@peebee/shared/demo-food";
import { BadgeCheck, ChefHat, ChevronLeft, ChevronRight, Clock, Flame, Leaf, Link2, Lock, RotateCcw, Search, ShieldCheck, ShoppingBag, Snowflake, Store, Tag, Timer, UtensilsCrossed, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { cartOwnerId, formatCartDate } from "../../lib/cart";
import { listFoodCarts, listFoodEarlierCarts } from "../../lib/food-carts";
import { useRegisterNavBack } from "../../lib/nav-primary-action";
import { menuItemPricing } from "../../lib/product-pricing";
import { businessTypeOf, collectDishes, cuisineTags, dishesUnder, featuredDishes, hoursLabel, matchesQuery, menuSections, quickDishes, type SubHomeDish } from "../../lib/food-subhome";

const BADGE: Record<MenuItemBadge, string> = { trending: "Popular", new: "New", sale: "Offer" };

/** Photo for a dish: the demo photo, or the uploaded one (same rules as the restaurant page). */
function useDishPhoto(item: MenuItem) {
  const demo = demoFoodPhotoPath(item.id);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (demo || !item.photo_key) return;
    let live = true, objectUrl: string | null = null;
    const rev = item.updated_at ? Date.parse(item.updated_at.includes("T") ? item.updated_at : item.updated_at.replace(" ", "T") + "Z") : undefined;
    api.menuItemPhotoBlob(item.id, rev).then((blob) => { if (!live || !blob.type.startsWith("image/")) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, item.photo_key, item.updated_at, demo]);
  return demo ?? (item.photo_key ? url : null);
}

/** Cover for a business: demo cover, or its uploaded cover; null shows a plain icon. */
function useCover(b: Restaurant) {
  const demo = b.is_demo ? demoRestaurantPhotoPath(b.id) ?? null : null;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (demo || !b.cover_key) return;
    let live = true, objectUrl: string | null = null;
    api.restaurantCoverBlob(b.id).then((blob) => { if (!live || !blob.type.startsWith("image/")) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [b.id, b.cover_key, demo]);
  return demo ?? (b.cover_key ? url : null);
}

function Price({ item }: { item: MenuItem }) {
  const p = menuItemPricing(item);
  return <span className="fc-price">{p.from && <span className="fc-price__from">from</span>}<span className="fc-price__ccy">UGX</span><span className="fc-price__amount">{p.price.toLocaleString("en-UG")}</span></span>;
}

const dishHref = (d: SubHomeDish) => `/restaurants/${d.restaurant.id}/items/${d.item.id}`;

function AddPill({ d }: { d: SubHomeDish }) {
  if (!d.restaurant.is_open) return <span className="fc-add" aria-disabled="true">Closed</span>;
  return <span className="fc-add" data-choose=""><span>Add</span><span aria-hidden="true">+</span></span>;
}

/** Featured card: full photo, frosted base, badge top-right, prep time top-left. */
function FeaturedCard({ d, showPlace = true }: { d: SubHomeDish; showPlace?: boolean }) {
  const photo = useDishPhoto(d.item);
  return (
    <article className="fc-card fc-card--featured">
      <Link href={dishHref(d)} className="fc-hit" aria-label={`View ${d.item.name} from ${d.restaurant.name}`} />
      <span className={`fc-feature__media ${photo ? "" : "is-empty"}`} aria-hidden="true">
        {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <UtensilsCrossed size={44} />}
        <span className="fc-feature__blur" /><span className="fc-feature__tint" />
      </span>
      {d.item.prep_time_minutes ? <span className="fc-glass-pill fc-overlay fc-overlay--left"><Clock size={13} aria-hidden="true" />{d.item.prep_time_minutes} min</span> : null}
      {d.item.badge && <span className="fc-badge fc-overlay fc-overlay--right"><BadgeCheck size={12} strokeWidth={2.4} aria-hidden="true" />{BADGE[d.item.badge]}</span>}
      <span className="fc-feature__body">
        <h3 className="fc-name" title={d.item.name}>{d.item.name}</h3>
        {showPlace && <span className="fc-desc">{d.restaurant.name}</span>}
        <span className="fc-row"><span className="fc-feature__left"><Price item={d.item} /></span><AddPill d={d} /></span>
      </span>
    </article>
  );
}

/** General card: photo in a rounded square, badge top-left, prep time in the bottom row, one-line title. */
function GeneralCard({ d }: { d: SubHomeDish }) {
  const photo = useDishPhoto(d.item);
  return (
    <article className="fc-card fc-card--general">
      <Link href={dishHref(d)} className="fc-hit" aria-label={`View ${d.item.name} from ${d.restaurant.name}`} />
      <span className={`fc-general__media ${photo ? "" : "is-empty"}`}>
        {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <UtensilsCrossed size={34} />}
        {d.item.badge && <span className="fc-badge fc-overlay fc-overlay--left"><BadgeCheck size={12} strokeWidth={2.4} aria-hidden="true" />{BADGE[d.item.badge]}</span>}
      </span>
      <span className="fc-general__body">
        <h3 className="fc-name" title={d.item.name}>{d.item.name}</h3>
        <span className="fc-desc">{d.restaurant.name}</span>
        <Price item={d.item} />
        <span className="fc-row">
          <span className="fc-meta">{d.item.prep_time_minutes ? <span className="fc-meta__item"><Clock size={13} aria-hidden="true" />{d.item.prep_time_minutes} min</span> : null}</span>
          <AddPill d={d} />
        </span>
      </span>
    </article>
  );
}

function Rail({ dishes, label, showPlace = true }: { dishes: SubHomeDish[]; label: string; showPlace?: boolean }) {
  return <div aria-label={label} className="edge-carousel food-dish-rail rail-visible flex snap-x snap-mandatory gap-3 overflow-x-auto pb-6 pt-1">{dishes.map((d) => <FeaturedCard key={d.item.id} d={d} showPlace={showPlace} />)}</div>;
}

function Grid({ dishes }: { dishes: SubHomeDish[] }) {
  return <div className="grid grid-cols-2 gap-3">{dishes.map((d) => <GeneralCard key={d.item.id} d={d} />)}</div>;
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return <section className="fsh-sec"><div className="fsh-hd"><h2>{title}</h2>{aside && <span className="fsh-aside">{aside}</span>}</div>{children}</section>;
}

/** Wide business row: cover, open state, type, name, cuisine, published hours. */
function BusinessRow({ b }: { b: Restaurant }) {
  const cover = useCover(b);
  const hours = hoursLabel(b);
  return (
    <Link href={`/restaurants/${b.id}`} className="fsh-shop">
      <span className="fsh-shop__img">{cover ? <img src={cover} alt="" loading="lazy" /> : <Store size={30} aria-hidden="true" />}<span className={`fsh-chip ${b.is_open ? "is-open" : "is-shut"}`}>{b.is_open ? "Open" : "Closed"}</span></span>
      <span className="fsh-shop__body">
        <small className="fsh-gold">{foodBusinessLabel(b.business_type)}</small>
        <b>{b.name}</b>
        {b.cuisine && <small className="fsh-muted fsh-1">{b.cuisine}</small>}
        {hours && <span className="fsh-meta"><Clock size={12} aria-hidden="true" />{hours}</span>}
      </span>
      <ChevronRight size={18} className="fsh-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}

function Stall({ b }: { b: Restaurant }) {
  const cover = useCover(b);
  return (
    <Link href={`/restaurants/${b.id}`} className="fsh-stall">
      <span className="fsh-stall__av">{cover ? <img src={cover} alt="" loading="lazy" /> : <ChefHat size={24} aria-hidden="true" />}</span>
      <span className="min-w-0 flex-1"><b className="fsh-1">{b.name}</b>{b.cuisine && <small className="fsh-muted fsh-1">{b.cuisine}</small>}<small className={b.is_open ? "fsh-gold" : "fsh-muted"}>{b.is_open ? "Open now" : "Closed"}</small></span>
      <ChevronRight size={18} className="fsh-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}

function SectionTile({ name, restaurantId, item }: { name: string; restaurantId: string; item: MenuItem | null }) {
  const photo = useDishPhoto(item ?? ({ id: "", photo_key: null } as MenuItem));
  return <Link href={`/restaurants/${restaurantId}`} className="fsh-bento__tile">{photo ? <img src={photo} alt="" loading="lazy" /> : <span className="fsh-bento__empty"><UtensilsCrossed size={28} aria-hidden="true" /></span>}<span className="fsh-bento__label"><b>{name}</b></span></Link>;
}

const COPY: Record<FoodBusinessType, { eyebrow: string; title: string; search: string }> = {
  restaurant: { eyebrow: "Sit-down favourites, delivered", title: "Restaurants", search: "Search restaurants…" },
  kitchen: { eyebrow: "Home kitchens", title: "Craving home cooking?", search: "Search dishes…" },
  bakery: { eyebrow: "Fresh from the oven", title: "Bakeries", search: "Search bakes…" },
  street_food: { eyebrow: "Hot off the pan", title: "Street food", search: "Search street food…" },
  juices: { eyebrow: "Pressed and sealed", title: "Juices", search: "Search juices…" },
};

type Mood = { key: string; label: string; Icon: typeof Flame; test: (d: SubHomeDish) => boolean };
const MOODS: Mood[] = [
  { key: "quick", label: "Under 30 min", Icon: Timer, test: (d) => !!d.item.prep_time_minutes && d.item.prep_time_minutes <= 30 },
  { key: "trending", label: "Popular", Icon: Flame, test: (d) => d.item.badge === "trending" },
  { key: "new", label: "New", Icon: Sparkles, test: (d) => d.item.badge === "new" },
  { key: "sale", label: "Offers", Icon: Tag, test: (d) => d.item.badge === "sale" },
];

export function FoodSubHome({ type }: { type: FoodBusinessType }) {
  const router = useRouter();
  useRegisterNavBack(true, () => router.push("/food"));
  const [all, setAll] = useState<Restaurant[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [menus, setMenus] = useState<Record<string, RestaurantMenu | undefined>>({});
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [carts, setCarts] = useState<{ earlier: ReturnType<typeof listFoodEarlierCarts>; open: ReturnType<typeof listFoodCarts> }>({ earlier: [], open: [] });
  const copy = COPY[type];
  const info = FOOD_BUSINESS_TYPES.find((t) => t.value === type);

  useEffect(() => {
    let live = true;
    api.listRestaurants().then((res) => { if (!live) return; setAll(res.restaurants); setPaused(!!res.paused); }).catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, [attempt]);

  const businesses = useMemo(() => (all ?? []).filter((b) => businessTypeOf(b) === type), [all, type]);

  useEffect(() => {
    let live = true;
    for (const b of businesses) {
      api.getRestaurantMenu(b.id).then((m) => { if (live) setMenus((prev) => ({ ...prev, [b.id]: m })); }).catch(() => {});
    }
    return () => { live = false; };
  }, [businesses]);

  useEffect(() => {
    queueMicrotask(() => { try { const owner = cartOwnerId(); setCarts({ earlier: listFoodEarlierCarts(owner), open: listFoodCarts(owner) }); } catch { /* storage unavailable */ } });
  }, []);

  const ids = new Set(businesses.map((b) => b.id));
  const shown = businesses.filter((b) => (!openOnly || !!b.is_open) && (!tag || (b.cuisine ?? "").includes(tag)) && matchesQuery(`${b.name} ${b.cuisine ?? ""} ${b.description ?? ""}`, query));
  const shownIds = new Set(shown.map((b) => b.id));
  const dishesAll = collectDishes(businesses, menus);
  const dishes = dishesAll.filter((d) => (!openOnly || !!d.restaurant.is_open) && (!tag || (d.restaurant.cuisine ?? "").includes(tag)) && (shownIds.has(d.restaurant.id) || matchesQuery(d.item.name, query)) && (matchesQuery(`${d.item.name} ${d.restaurant.name}`, query)));
  const featured = featuredDishes(dishes);
  const earlier = carts.earlier.find((c) => ids.has(c.restaurantId));
  const openCart = carts.open.find((c) => ids.has(c.restaurantId));
  const openCount = businesses.filter((b) => b.is_open).length;
  const loading = !error && all === null;

  const list = (title: string) => shown.length > 0 && (
    <Section title={title} aside={`${shown.length} ${shown.length === 1 ? "place" : "places"}`}><div className="fsh-list">{shown.map((b) => <BusinessRow key={b.id} b={b} />)}</div></Section>
  );

  const search = (
    <div className="fsh-search">
      <Search size={18} aria-hidden="true" />
      <input aria-label={copy.search.replace("…", "")} placeholder={copy.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      <button type="button" className={`fsh-toggle ${openOnly ? "is-on" : ""}`} aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)}>Open now</button>
    </div>
  );

  let body: React.ReactNode = null;
  if (type === "restaurant") {
    const tags = cuisineTags(businesses);
    body = <>
      {search}
      {tags.length > 1 && <div className="fsh-pills" role="group" aria-label="Cuisine"><button type="button" aria-pressed={!tag} className={!tag ? "is-on" : ""} onClick={() => setTag(null)}>All</button>{tags.map((t) => <button key={t} type="button" aria-pressed={tag === t} className={tag === t ? "is-on" : ""} onClick={() => setTag(tag === t ? null : t)}>{t}</button>)}</div>}
      {featured.length > 0 && <Section title="Tonight's table" aside="Chef-picked"><Rail dishes={featured.slice(0, 8)} label="Featured dishes" /></Section>}
      {earlier && <Link href={`/restaurants/${earlier.restaurantId}`} className="fsh-again"><span><small className="fsh-gold">Order again</small><b className="fsh-1">{earlier.restaurantName || "Your earlier order"}</b><small className="fsh-muted">Saved {formatCartDate(earlier.updatedAt)} · {earlier.count} item{earlier.count === 1 ? "" : "s"}</small></span><span className="fsh-goldbtn"><RotateCcw size={15} aria-hidden="true" />Reorder</span></Link>}
      {list("All restaurants")}
    </>;
  } else if (type === "kitchen") {
    const moods = MOODS.filter((m) => dishesAll.some(m.test));
    const picked = mood ? dishes.filter(MOODS.find((m) => m.key === mood)!.test) : dishes;
    body = <>
      {search}
      {moods.length > 0 && <div className="fsh-chips" role="group" aria-label="Filter dishes"><button type="button" aria-pressed={!mood} className={!mood ? "is-on" : ""} onClick={() => setMood(null)}>All dishes</button>{moods.map((m) => <button key={m.key} type="button" aria-pressed={mood === m.key} className={mood === m.key ? "is-on" : ""} onClick={() => setMood(mood === m.key ? null : m.key)}><m.Icon size={14} aria-hidden="true" />{m.label}</button>)}</div>}
      {picked.length > 0 && <Section title="On the menu" aside={`${picked.length} dish${picked.length === 1 ? "" : "es"} · ${new Set(picked.map((d) => d.restaurant.id)).size} kitchens`}><Grid dishes={picked.slice(0, 8)} /></Section>}
      {list("All kitchens")}
    </>;
  } else if (type === "bakery") {
    const sections = menuSections(businesses.filter((b) => shownIds.has(b.id)), menus);
    body = <>
      {search}
      {sections.length > 0 && <Section title="Shop by bake"><div className={`fsh-bento n${sections.length}`}>{sections.map((s) => <SectionTile key={s.name} name={s.name} restaurantId={s.restaurantId} item={s.item} />)}</div></Section>}
      {openCart && <Link href={`/restaurants/${openCart.restaurantId}`} className="fsh-again"><span><small className="fsh-gold">Saved cart</small><b className="fsh-1">{openCart.restaurantName || "Bakery cart"}</b><small className="fsh-muted">{openCart.count} item{openCart.count === 1 ? "" : "s"} · not ordered yet</small></span><span className="fsh-goldbtn"><ShoppingBag size={15} aria-hidden="true" />Open</span></Link>}
      {featured.length > 0 && <Section title="Baker's picks"><Rail dishes={featured.slice(0, 8)} label="Featured bakes" /></Section>}
      {list("All bakeries")}
    </>;
  } else if (type === "street_food") {
    const quick = quickDishes(dishes, 15);
    const cheap = dishesUnder(dishes, 10000);
    body = <>
      {openCount > 0 && <p className="fsh-ticker" role="status"><Flame size={16} aria-hidden="true" />{openCount} {openCount === 1 ? "stall is" : "stalls are"} open now</p>}
      {search}
      {shown.length > 0 && <Section title="Stalls" aside={`${shown.length} ${shown.length === 1 ? "stall" : "stalls"}`}><div className="fsh-list">{shown.map((b) => <Stall key={b.id} b={b} />)}</div></Section>}
      {quick.length > 0 && <Section title="Quick bites" aside="Ready in 15 min or less"><Grid dishes={quick.slice(0, 6)} /></Section>}
      <Link href="/juices" className="fsh-combo"><span className="fsh-combo__ic"><Link2 size={18} aria-hidden="true" /></span><span><b>Add a juice</b><small className="fsh-muted">Combine baskets from two places into one delivery</small></span><ChevronRight size={18} className="fsh-muted" aria-hidden="true" /></Link>
      {cheap.length > 0 && <Section title="Under UGX 10,000"><Rail dishes={cheap.slice(0, 8)} label="Dishes under UGX 10,000" /></Section>}
    </>;
  } else {
    body = <>
      <div className="fsh-seal"><b><ShieldCheck size={18} aria-hidden="true" />Spill-Proof &amp; Freshness Guarantee</b><p>Drinks are freshly prepared and sealed in specialized spill-proof packaging to maintain optimal temperature and freshness during transit.</p><ul><li><Snowflake size={13} aria-hidden="true" />Kept cold</li><li><Lock size={13} aria-hidden="true" />Sealed</li><li><Leaf size={13} aria-hidden="true" />Fresh</li></ul></div>
      {search}
      {featured.length > 0 && <Section title="Featured drinks" aside={`${featured.length} drinks`}><Rail dishes={featured.slice(0, 8)} label="Featured drinks" /></Section>}
      <Link href="/bakeries" className="fsh-combo"><span className="fsh-combo__ic"><Link2 size={18} aria-hidden="true" /></span><span><b>Pair it with a bakery</b><small className="fsh-muted">Combine baskets from two places into one delivery</small></span><ChevronRight size={18} className="fsh-muted" aria-hidden="true" /></Link>
      {list("Juice bars")}
    </>;
  }

  return (
    <div className="fsh px-4 pb-8 pt-4" data-food-type={type}>
      <Link href="/food" className="fsh-back"><ChevronLeft size={18} aria-hidden="true" />Eat</Link>
      <p className="fsh-eyebrow">{copy.eyebrow}</p>
      <h1 className="fsh-title">{copy.title}</h1>
      {paused && <p role="status" className="home-card mt-4 text-sm">Food ordering is currently paused by the platform.</p>}
      {error && <div role="alert" className="home-card mt-4 text-sm"><p className="font-semibold">Couldn&apos;t load {info?.label.toLowerCase() ?? "food places"}.</p><p className="mt-1 text-ink-500">{error}</p><button type="button" className="fsh-goldbtn mt-3" onClick={() => { setError(null); setAll(null); setAttempt((n) => n + 1); }}>Try again</button></div>}
      {loading && <p role="status" className="py-8 text-center text-sm text-ink-500">Loading {info?.label.toLowerCase() ?? "food places"}…</p>}
      {!error && all !== null && (businesses.length === 0
        ? <div className="home-card mt-5 py-8 text-center"><p className="font-semibold">Nothing here just yet.</p><p className="mt-2 text-sm text-ink-500">No places in this category are taking orders right now.</p><Link href="/food" className="fsh-goldbtn mt-4 inline-flex">Browse all food</Link></div>
        : <>{body}{shown.length === 0 && dishes.length === 0 && <div className="home-card mt-5 py-8 text-center"><p className="font-semibold">No matches.</p><p className="mt-2 text-sm text-ink-500">Try another search{openOnly ? " or include closed places" : ""}.</p></div>}</>)}
    </div>
  );
}
