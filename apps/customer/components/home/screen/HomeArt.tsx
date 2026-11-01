"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { HomeFeature, HomeFeatureId } from "../../../lib/home-catalog";

/** Press, and a short wheel spin on a boda. Still when reduced motion is on. */
export function HomeMotion() {
  return (
    <style>{`
      .peebee-press { transition: transform 160ms ease; }
      .wheel { transform-box: fill-box; transform-origin: center; }
      @media (prefers-reduced-motion: no-preference) {
        .peebee-press:active { transform: scale(0.98); }
        .peebee-press:active .wheel { animation: peebee-spin 0.7s linear; }
      }
      @keyframes peebee-spin { to { transform: rotate(360deg); } }
    `}</style>
  );
}

function Art({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {children}
    </svg>
  );
}

const ink = "fill-ink";
const line = "fill-none stroke-ink";
const gold = "fill-gold";

export function BodaArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <circle className={`wheel ${line}`} cx="22" cy="58" r="11" strokeWidth="3" />
      <circle className={`wheel ${line}`} cx="58" cy="58" r="11" strokeWidth="3" />
      <path className={line} d="M22 58 34 40h16l8 18" strokeWidth="3" strokeLinejoin="round" />
      <path className={gold} d="M36 40h12l2 8H34z" />
      <circle className={ink} cx="46" cy="24" r="7" />
      <path className={line} d="M40 32c8 1 12 6 14 12" strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}

export function BasketArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={line} d="M18 32h44l-6 30H24z" strokeWidth="3" />
      <path className={line} d="M28 32c0-10 24-10 24 0" strokeWidth="3" />
      <path className={gold} d="M30 44h6M38 48h8M28 56h10" strokeWidth="3" strokeLinecap="round" />
      <circle className={gold} cx="46" cy="40" r="4" />
      <circle className={ink} cx="34" cy="40" r="3" />
    </Art>
  );
}

export function ParcelArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={line} d="M8 40h14M6 48h12" strokeWidth="3" strokeLinecap="round" />
      <path className={ink} d="M30 28h24l10 12v22H30z" />
      <path className={gold} d="M30 40h34v6H30z" />
      <path className="fill-cream" d="M42 28h4v12h-4z" />
    </Art>
  );
}

export function PlateArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <ellipse className={line} cx="40" cy="48" rx="26" ry="10" strokeWidth="3" />
      <path className={gold} d="M24 44c6-14 26-14 32 0-8 4-24 4-32 0z" />
      <circle className={ink} cx="34" cy="40" r="3" />
      <circle className={ink} cx="46" cy="38" r="2.5" />
    </Art>
  );
}

export function JuiceArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M30 28h20l-3 36H33z" />
      <path className={gold} d="M32 40h16l-1 16H33z" />
      <path className={line} d="M36 28c2-8 8-8 10 0" strokeWidth="3" />
    </Art>
  );
}

export function LoafArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={gold} d="M16 46c0-14 14-22 24-22s24 8 24 22v8H16z" />
      <path className={ink} d="M22 46c2-8 8-12 18-12s16 4 18 12" fill="none" strokeWidth="3" />
      <path className={line} d="M16 54h48" strokeWidth="3" />
    </Art>
  );
}

export function CarArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M16 48 24 34h32l8 14v10H16z" />
      <path className={gold} d="M28 36h24l4 10H24z" />
      <circle className="wheel fill-cream stroke-ink" cx="28" cy="58" r="6" strokeWidth="3" />
      <circle className="wheel fill-cream stroke-ink" cx="54" cy="58" r="6" strokeWidth="3" />
    </Art>
  );
}

export function TruckArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={gold} d="M14 30h34v26H14z" />
      <path className={ink} d="M48 40h16l6 8v8H48z" />
      <circle className="wheel fill-cream stroke-ink" cx="26" cy="58" r="6" strokeWidth="3" />
      <circle className="wheel fill-cream stroke-ink" cx="58" cy="58" r="6" strokeWidth="3" />
    </Art>
  );
}

export function BusArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M16 28h48v30H16z" />
      <path className={gold} d="M22 34h14v10H22zM40 34h14v10H40z" />
      <circle className="wheel fill-cream" cx="28" cy="60" r="5" />
      <circle className="wheel fill-cream" cx="54" cy="60" r="5" />
    </Art>
  );
}

export function AmbulanceArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M14 36h32v20H14z" />
      <path className={gold} d="M46 42h18v14H46z" />
      <path className="fill-cream" d="M26 42h6v4h4v6h-4v4h-6v-4h-4v-6h4z" />
      <circle className="wheel fill-cream stroke-ink" cx="24" cy="58" r="5" strokeWidth="2.5" />
      <circle className="wheel fill-cream stroke-ink" cx="52" cy="58" r="5" strokeWidth="2.5" />
    </Art>
  );
}

export function ShopArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={gold} d="M14 34 22 22h36l8 12z" />
      <path className={ink} d="M20 34h40v24H20z" />
      <path className="fill-cream" d="M34 44h12v14H34z" />
    </Art>
  );
}

export function BottleArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M34 18h12v10l8 14v22H26V42l8-14z" />
      <path className={gold} d="M30 46h20v14H30z" />
    </Art>
  );
}

export function ReceiptArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M24 16h32v48l-6-4-6 4-6-4-6 4-8-4z" />
      <path className={gold} d="M30 28h20M30 36h16M30 44h12" strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}

export function ClothArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={gold} d="M16 28c12 8 36 8 48 0l-6 32H22z" />
      <path className={ink} d="M28 26c4 10 20 10 24 0" fill="none" strokeWidth="3" />
    </Art>
  );
}

export function ShirtArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M28 22 18 32l8 6 4-6h20l4 6 8-6-10-10-8 6h-8z" />
      <path className={gold} d="M30 38h20v22H30z" />
    </Art>
  );
}

export function ToolArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M22 50 46 26l8 8-24 24z" />
      <path className={gold} d="M48 22c8 0 14 8 10 16l-8-8z" />
    </Art>
  );
}

export function PeopleArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <circle className={ink} cx="30" cy="28" r="7" />
      <circle className={gold} cx="50" cy="30" r="6" />
      <path className={ink} d="M16 58c2-12 10-16 14-16s12 4 14 16z" />
      <path className={gold} d="M40 58c2-10 8-14 12-14s10 4 12 14z" />
    </Art>
  );
}

export function BookArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M16 22h22v40H16z" />
      <path className={gold} d="M38 22h26v40H38z" />
      <path className="fill-cream" d="M38 22v40" strokeWidth="2" />
    </Art>
  );
}

export function LiveArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <circle className={gold} cx="40" cy="42" r="8" />
      <path className={line} d="M24 34a22 22 0 0 0 0 16M56 34a22 22 0 0 1 0 16" strokeWidth="3" strokeLinecap="round" />
      <path className={line} d="M16 28a32 32 0 0 0 0 28M64 28a32 32 0 0 1 0 28" strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}

export function TvArt({ className }: { className?: string }) {
  return (
    <Art className={className}>
      <path className={ink} d="M14 24h52v34H14z" />
      <path className={gold} d="M20 30h40v22H20z" />
      <path className={line} d="M32 58l-6 8M48 58l6 8" strokeWidth="3" strokeLinecap="round" />
    </Art>
  );
}

const SPOT: Partial<Record<HomeFeatureId, (props: { className?: string }) => ReactNode>> = {
  "shopping-list": BasketArt,
  list: BasketArt,
  groceries: BasketArt,
  boda: BodaArt,
  food: PlateArt,
  restaurants: PlateArt,
  kitchens: PlateArt,
  streetfood: PlateArt,
  juices: JuiceArt,
  bakeries: LoafArt,
  parcel: ParcelArt,
  car: CarArt,
  luxury: CarArt,
  selfdrive: CarArt,
  rideshare: CarArt,
  move: TruckArt,
  taxipress: BusArt,
  ambulance: AmbulanceArt,
  stores: ShopArt,
  pharmacy: BottleArt,
  orders: ReceiptArt,
  clean: ClothArt,
  laundry: ShirtArt,
  fix: ToolArt,
  workers: PeopleArt,
  hire: PeopleArt,
  connect: PeopleArt,
  "my-class": BookArt,
  discover: BookArt,
  live: LiveArt,
  tv: TvArt,
};

export function Spot({ id, className }: { id: HomeFeatureId; className?: string }) {
  const Draw = SPOT[id] ?? BasketArt;
  return <Draw className={className} />;
}

/** Hills, a low sun, and a road. The golden-hour scene. */
export function KampalaScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} aria-hidden>
      <defs>
        <pattern id="peebee-weave" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 7h14M7 0v14" className="stroke-gold" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="360" height="220" className="fill-cream" />
      <rect width="360" height="220" fill="url(#peebee-weave)" opacity="0.35" />
      <circle cx="286" cy="54" r="36" className="fill-gold" />
      <circle cx="286" cy="54" r="22" className="fill-cream" opacity="0.35" />
      <path className="fill-gold" opacity="0.45" d="M0 150c40-28 80-20 120-36s70-8 110 6 80 10 130-16v116H0z" />
      <path className="fill-ink" d="M0 168c50-36 90-18 140-34s80 4 120-8 70-6 100 12v82H0z" />
      <path className="fill-gold" d="M0 196h360v8H0z" />
      <g transform="translate(118 78) scale(0.95)">
        <BodaArt className="h-20 w-20" />
      </g>
    </svg>
  );
}

export function Weave({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden>
      <defs>
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M0 9h18M9 0v18M0 0l18 18M18 0L0 18" className="stroke-ink" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function ArtLink({
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
  const cls = `peebee-press ${className}`;
  if (feature.href) {
    return (
      <Link href={feature.href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(feature)} className={cls}>
      {children}
    </button>
  );
}
