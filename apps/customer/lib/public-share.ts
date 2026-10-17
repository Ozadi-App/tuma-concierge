/**
 * Server-side data and text for a product's or dish's own shareable page:
 * what search engines and link previews (WhatsApp, Facebook, X, Telegram…)
 * read, and what someone who isn't signed in sees when they open a shared link.
 * Uses only the API's public endpoints, so it works without a session.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://customer.peebee.online").replace(/\/$/, "");
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");
const FALLBACK_IMAGE = "/icons/icon-512.png";

export type PublicProduct = {
  id: string; title: string; description: string | null; price: number; compareAtPrice: number | null;
  categoryName: string | null; badge: string | null; image: string | null; status: string | null; inStock: boolean;
  variants: Array<{ title: string; price: number }>;
  store: { id: string; name: string; address: string | null; isOpen: boolean } | null;
};

export type PublicDish = {
  restaurant: { id: string; name: string; cuisine: string | null; address: string | null; businessType: string | null; isOpen: boolean };
  item: {
    id: string; name: string; description: string | null; price: number; available: boolean;
    prepTimeMinutes: number | null; badge: string | null; categoryName: string | null; photo: string | null;
    options: Array<{ name: string; required: boolean; choices: Array<{ name: string; priceDelta: number }> }>;
  };
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/v1${path}`, { next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type Raw = Record<string, unknown>;

export async function fetchPublicProduct(id: string): Promise<PublicProduct | null> {
  const res = await getJson<{ product?: Raw; store?: Raw | null }>(`/marketplace/products/${encodeURIComponent(id)}`);
  const p = res?.product;
  if (!p) return null;
  const variants = Array.isArray(p.variants) ? (p.variants as Raw[]) : [];
  const tracked = Number(p.track_inventory ?? 0) === 1;
  const s = res?.store ?? null;
  return {
    id: String(p.id),
    title: String(p.title ?? "Product"),
    description: (p.description as string | null) ?? null,
    price: Number(p.price ?? 0),
    compareAtPrice: p.compare_at_price == null ? null : Number(p.compare_at_price),
    categoryName: (p.category_name as string | null) ?? null,
    badge: (p.badge as string | null) ?? null,
    image: (p.image_url as string | null) ?? null,
    status: (p.status as string | null) ?? null,
    inStock: !tracked || Number(p.inventory_quantity ?? 0) > 0,
    variants: variants.map((v) => ({ title: String(v.title ?? ""), price: Number(v.price ?? 0) })),
    store: s ? { id: String(s.id), name: String(s.name ?? ""), address: (s.address as string | null) ?? null, isOpen: Number(s.is_open ?? 1) === 1 } : null,
  };
}

export async function fetchPublicDish(restaurantId: string, itemId: string): Promise<PublicDish | null> {
  return getJson<PublicDish>(`/public/food/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(itemId)}`);
}

export const productPath = (id: string) => `/product/${encodeURIComponent(id)}`;
export const dishPath = (restaurantId: string, itemId: string) => `/restaurants/${encodeURIComponent(restaurantId)}/items/${encodeURIComponent(itemId)}`;

/** An absolute URL for an image path or URL (demo photos live on this site). */
export function absoluteImage(src: string | null | undefined): string {
  const value = src || FALLBACK_IMAGE;
  return /^https?:\/\//i.test(value) ? value : `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export const ugx = (amount: number) => `UGX ${Math.round(amount).toLocaleString("en-US")}`;

/** Plain text, one line, cut on a word boundary. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:\s]+$/, "")}…`;
}

const sentence = (text: string | null | undefined) => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : "";
};

function priceText(price: number, variants: Array<{ price: number }>): string {
  const prices = [price, ...variants.map((v) => v.price)].filter((n) => n > 0);
  const low = Math.min(...prices), high = Math.max(...prices);
  return prices.length > 1 && high > low ? `from ${ugx(low)}` : ugx(price);
}

/** Title, short and long descriptions for a product's page and previews. */
export function productText(p: PublicProduct) {
  const store = p.store?.name ? ` from ${p.store.name}` : "";
  // A "was" price belongs to the product's own price, not to a range of options.
  const saving = p.compareAtPrice && p.compareAtPrice > p.price ? ` (was ${ugx(p.compareAtPrice)})` : "";
  const price = saving ? ugx(p.price) : priceText(p.price, p.variants);
  const options = p.variants.length > 1 ? ` Choose from ${p.variants.length} options: ${p.variants.slice(0, 4).map((v) => `${v.title} (${ugx(v.price)})`).join(", ")}${p.variants.length > 4 ? " and more" : ""}.` : "";
  const where = p.store?.address ? ` ${p.store.name} is at ${p.store.address}.` : "";
  const long = [
    `${p.title}${store}, ${price}${saving} on Peebee.`,
    sentence(p.description),
    p.categoryName ? `Category: ${p.categoryName}.` : "",
    options.trim(),
    where.trim(),
    p.inStock ? "In stock now: order in the Peebee app and a Peebee rider brings it to your door, paid safely in the app." : "Currently out of stock; open Peebee to see when it's back.",
  ].filter(Boolean).join(" ");
  return {
    title: `${p.title}${store} | ${price}`,
    description: clip(long, 160),
    longDescription: clip(long, 600),
  };
}

/** Title, short and long descriptions for a dish's page and previews. */
export function dishText(d: PublicDish) {
  const { item, restaurant } = d;
  const kind = restaurant.businessType ? restaurant.businessType.replace(/_/g, " ") : "restaurant";
  const extras = item.options.filter((o) => o.choices.length).slice(0, 3)
    .map((o) => `${o.name}: ${o.choices.slice(0, 4).map((c) => c.priceDelta > 0 ? `${c.name} (+${ugx(c.priceDelta)})` : c.name).join(", ")}`);
  const long = [
    `${item.name} from ${restaurant.name}, ${ugx(item.price)} on Peebee Food.`,
    sentence(item.description),
    restaurant.cuisine ? `${restaurant.name} is a ${restaurant.cuisine} ${kind}${restaurant.address ? ` at ${restaurant.address}` : ""}.` : restaurant.address ? `${restaurant.name} is at ${restaurant.address}.` : "",
    item.categoryName ? `On the menu under ${item.categoryName}.` : "",
    item.prepTimeMinutes ? `Ready in about ${item.prepTimeMinutes} minutes.` : "",
    extras.length ? `Make it yours: ${extras.join("; ")}.` : "",
    item.available ? "Order in the Peebee app and a Peebee rider brings it hot to your door." : "Not available right now; open Peebee to see the rest of the menu.",
  ].filter(Boolean).join(" ");
  return {
    title: `${item.name} from ${restaurant.name} | ${ugx(item.price)}`,
    description: clip(long, 160),
    longDescription: clip(long, 600),
  };
}

/** schema.org Product for a marketplace item (search engines' rich results). */
export function productJsonLd(p: PublicProduct) {
  const url = `${SITE_URL}${productPath(p.id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: productText(p).longDescription,
    image: [absoluteImage(p.image)],
    sku: p.id,
    category: p.categoryName ?? undefined,
    brand: p.store?.name ? { "@type": "Brand", name: p.store.name } : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "UGX",
      price: p.price,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: p.store?.name ? { "@type": "Organization", name: p.store.name } : undefined,
    },
  };
}

/** schema.org MenuItem, with its restaurant, for a dish. */
export function dishJsonLd(d: PublicDish) {
  const url = `${SITE_URL}${dishPath(d.restaurant.id, d.item.id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: d.item.name,
    description: dishText(d).longDescription,
    image: absoluteImage(d.item.photo),
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "UGX",
      price: d.item.price,
      availability: d.item.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    menuAddOn: d.item.options.flatMap((o) => o.choices.map((c) => ({ "@type": "MenuItem", name: `${o.name}: ${c.name}`, offers: { "@type": "Offer", price: c.priceDelta, priceCurrency: "UGX" } }))).slice(0, 20),
    isPartOf: {
      "@type": "Restaurant",
      name: d.restaurant.name,
      servesCuisine: d.restaurant.cuisine ?? undefined,
      address: d.restaurant.address ?? undefined,
      url: `${SITE_URL}/restaurants/${encodeURIComponent(d.restaurant.id)}`,
    },
  };
}

/** A JSON-LD <script> body, safe to inline. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
