"use client";

import type { FoodNearbyItem } from "@peebee/shared";
import { demoFoodPhotoPath } from "@peebee/shared/demo-food";
import { ArrowRight, Beef, ChevronDown, Clock, CupSoda, Drumstick, EggFried, LayoutGrid, LocateFixed, MapPin, Navigation, Pizza, Plus, Search, SlidersHorizontal, Soup, UtensilsCrossed, Wheat, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { EAT_CHIPS, type EatChipId, dishHref, eatSections, kmLabel, ugx } from "../../lib/eat-home";
import { getStoredCustomerCoordinates, setCachedCustomerCoordinates } from "../../lib/location";
import { useLocationLabel } from "../../lib/use-location-label";

const CHIP_ICONS: Record<EatChipId, LucideIcon> = { all: LayoutGrid, rolex: EggFried, pilau: Soup, burger: Beef, pizza: Pizza, chicken: Drumstick, juice: CupSoda, chapati: Wheat };
const RADII = [2, 5, 10] as const;

function useNearbyPhoto(item: FoodNearbyItem) {
  const demo = item.isDemo ? demoFoodPhotoPath(item.id) : undefined;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (demo || !item.photoKey) return;
    let live = true, objectUrl: string | null = null;
    const rev = item.updatedAt ? Date.parse(item.updatedAt.includes("T") ? item.updatedAt : item.updatedAt.replace(" ", "T") + "Z") : undefined;
    api.menuItemPhotoBlob(item.id, rev).then((blob) => { if (!live || !blob.type.startsWith("image/")) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, item.photoKey, item.updatedAt, demo]);
  return demo ?? (item.photoKey ? url : null);
}

/** Real coordinates only (geolocation now, or the last place the phone reported); never a default city. */
function useEatLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"locating" | "ready" | "none">("locating");
  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCachedCustomerCoordinates(next); setCoords(next); setState("ready"); },
      () => {},
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      const stored = getStoredCustomerCoordinates();
      // Without a stored place, show what's open now and refine once the phone answers.
      if (stored) setCoords(stored);
      setState(stored ? "ready" : "none");
      locate();
    });
  }, [locate]);
  return { coords, state, locate };
}

function Price({ item, className }: { item: FoodNearbyItem; className: string }) {
  return <div className={className}><small>{item.from ? "From UGX" : "UGX"}</small>{ugx(item.price)}</div>;
}

function Place({ item }: { item: FoodNearbyItem }) {
  const km = kmLabel(item.distanceKm);
  return <div className="eh-place"><MapPin aria-hidden="true" /><b>{item.restaurantName}</b>{km && <span>· {km}</span>}</div>;
}

function Photo({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="eh-noimg" aria-hidden="true"><UtensilsCrossed /></span>;
}

function FeaturedCard({ item }: { item: FoodNearbyItem }) {
  const photo = useNearbyPhoto(item);
  const km = kmLabel(item.distanceKm);
  return (
    <article className="eh-feat">
      <Link href={dishHref(item)} className="eh-hit" aria-label={`View ${item.name} from ${item.restaurantName}`} />
      {photo && <div className="eh-fbg" style={{ backgroundImage: `url(${JSON.stringify(photo)})` }} aria-hidden="true" />}
      {photo ? <img className="eh-fimg" src={photo} alt="" decoding="async" /> : <span className="eh-noimg eh-noimg--feat" aria-hidden="true"><UtensilsCrossed /></span>}
      <div className="eh-fglass" aria-hidden="true" />
      <div className="eh-ftxt">
        <span className="eh-fbadge">Featured</span>
        <h3>{item.name}</h3>
        {item.description && <p>{item.description}</p>}
        <div className="eh-fmeta">
          {item.prepTimeMinutes ? <span><Clock aria-hidden="true" />{item.prepTimeMinutes} min</span> : null}
          <span><MapPin aria-hidden="true" />{item.restaurantName}{km ? ` · ${km}` : ""}</span>
        </div>
        <Price item={item} className="eh-fprice" />
      </div>
      <span className="eh-fgo" aria-hidden="true"><ArrowRight /></span>
    </article>
  );
}

function BestCard({ item }: { item: FoodNearbyItem }) {
  const photo = useNearbyPhoto(item);
  return (
    <article className="eh-bc">
      <Link href={dishHref(item)} className="eh-hit" aria-label={`View ${item.name} from ${item.restaurantName}`} />
      <Photo src={photo} />
      {item.prepTimeMinutes ? <span className="eh-gpill"><Clock aria-hidden="true" />{item.prepTimeMinutes} min</span> : null}
      <div className="eh-frost">
        <h3>{item.name}</h3>
        {item.description && <p>{item.description}</p>}
        <div className="eh-frow">
          <div className="eh-min"><Place item={item} /><Price item={item} className="eh-price" /></div>
          <span className="eh-add" aria-hidden="true"><Plus /></span>
        </div>
      </div>
    </article>
  );
}

function GridCard({ item }: { item: FoodNearbyItem }) {
  const photo = useNearbyPhoto(item);
  return (
    <article className="eh-gc">
      <Link href={dishHref(item)} className="eh-hit" aria-label={`View ${item.name} from ${item.restaurantName}`} />
      <Photo src={photo} />
      <div className="eh-frost">
        <h3>{item.name}</h3>
        <Place item={item} />
        <div className="eh-frow"><Price item={item} className="eh-price" /><span className="eh-add" aria-hidden="true"><Plus /></span></div>
      </div>
    </article>
  );
}

export function EatHome() {
  const { coords, state, locate } = useEatLocation();
  const { label } = useLocationLabel();
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [chip, setChip] = useState<EatChipId>("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [result, setResult] = useState<{ items: FoodNearbyItem[]; located: boolean; paused?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setTerm(query.trim()), 300); return () => clearTimeout(t); }, [query]);

  const chipQ = EAT_CHIPS.find((c) => c.id === chip)?.q ?? "";
  const q = term || chipQ;
  useEffect(() => {
    if (state === "locating") return;
    let live = true;
    api.foodNearbyItems({ lat: coords?.lat, lng: coords?.lng, radiusKm, q })
      .then((res) => { if (live) { setResult(res); setError(null); } })
      .catch((err) => { if (live) setError(errorMessage(err)); });
    return () => { live = false; };
  }, [coords?.lat, coords?.lng, state, radiusKm, q]);

  const located = !!result?.located;
  const items = result?.items ?? [];
  const { slider, best, more } = eatSections(items, (i) => (i.isDemo ? !!demoFoodPhotoPath(i.id) : !!i.photoKey));
  const within = `Within ${radiusKm} km`;

  const onScroll = () => {
    const el = track.current;
    if (el) setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  const pickChip = (id: EatChipId) => { setChip(id); setQuery(""); setTerm(""); setSlide(0); track.current?.scrollTo({ left: 0 }); };

  return (
    <div className="eh">
      <div className="eh-top">
        <button type="button" className="eh-loc" onClick={locate} aria-label={located ? `Location: ${label ?? "Your location"}. Tap to refresh` : "Set your location"}>
          <MapPin className="eh-pin" aria-hidden="true" /><span>{coords ? label ?? "Your location" : "Set location"}</span><ChevronDown className="eh-cv" aria-hidden="true" />
        </button>
        {located && <span className="eh-rad"><Navigation aria-hidden="true" />{within}</span>}
      </div>
      <h1 className="eh-h1">Delicious <em>food</em><br />near you</h1>
      <p className="eh-lede">{located ? `Fresh from kitchens within ${radiusKm} km.` : "Fresh from open kitchens across Peebee."}</p>

      <div className="eh-search">
        <Search aria-hidden="true" />
        <input aria-label="Search dishes or places" placeholder="Search dishes or places" value={query} maxLength={60}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value) setChip("all"); }} />
        <button type="button" className="eh-filt" aria-label="Distance filter" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal aria-hidden="true" /></button>
      </div>
      {showFilters && (
        <div className="eh-filters" role="group" aria-label="Distance">
          {RADII.map((r) => (
            <button key={r} type="button" className={`eh-chip ${radiusKm === r ? "is-on" : ""}`} aria-pressed={radiusKm === r} disabled={!located}
              onClick={() => { setRadiusKm(r); setShowFilters(false); }}>Within {r} km</button>
          ))}
          {!located && <p className="eh-note">Set your location to filter by distance.</p>}
        </div>
      )}

      <div className="eh-chips" role="group" aria-label="Food">
        {EAT_CHIPS.map((c) => {
          const Icon = CHIP_ICONS[c.id];
          return <button key={c.id} type="button" className={`eh-chip ${chip === c.id && !term ? "is-on" : ""}`} aria-pressed={chip === c.id && !term} onClick={() => pickChip(c.id)}><Icon aria-hidden="true" />{c.label}</button>;
        })}
      </div>

      {state !== "locating" && !located && result && !result.paused && (
        <div className="eh-prompt" role="status">
          <LocateFixed aria-hidden="true" />
          <div><b>Set your location</b><p>We’ll show dishes within {radiusKm} km. For now, here’s what’s open.</p></div>
          <button type="button" onClick={locate}>Use my location</button>
        </div>
      )}
      {result?.paused && <p role="status" className="eh-empty">Food ordering is currently paused by the platform.</p>}
      {error && <div role="alert" className="eh-empty"><b>Couldn’t load dishes.</b><p>{error}</p></div>}
      {!error && !result && <p role="status" className="eh-empty">Finding food near you…</p>}
      {!error && result && !result.paused && items.length === 0 && (
        <div className="eh-empty"><b>{q ? `No ${q} ${located ? `within ${radiusKm} km` : "right now"}.` : located ? `Nothing open within ${radiusKm} km yet.` : "Nothing open right now."}</b>
          <p>{located && radiusKm < 10 ? "Try a wider distance or another dish." : "Try another dish or check back soon."}</p></div>
      )}

      {slider.length > 0 && (
        <>
          <div className="eh-track" ref={track} onScroll={onScroll} aria-label="Featured dishes">
            {slider.map((i) => <FeaturedCard key={i.id} item={i} />)}
          </div>
          {slider.length > 1 && <div className="eh-dots" aria-hidden="true">{slider.map((i, n) => <i key={i.id} className={n === slide ? "is-on" : ""} />)}</div>}
        </>
      )}
      {best.length > 0 && (
        <>
          <div className="eh-sec"><h2>{located ? "Best food near you" : "Open now"}</h2>{located && <small>{within}</small>}</div>
          {best.map((i) => <BestCard key={i.id} item={i} />)}
        </>
      )}
      {more.length > 0 && (
        <>
          <div className="eh-sec"><h2>{located ? `More within ${radiusKm} km` : "More to try"}</h2><small>{more.length} dish{more.length === 1 ? "" : "es"}</small></div>
          <div className="eh-grid">{more.map((i) => <GridCard key={i.id} item={i} />)}</div>
        </>
      )}
    </div>
  );
}
