import { addToCart, type CartItem } from "./cart";

/**
 * Spotlight "Buy" → the shared marketplace cart (lib/cart.ts).
 *
 * Spotlight used to keep its own in-page `useState` cart, so anything bought
 * there never reached localStorage and never showed in the cart drawer or
 * /cart (and vanished on navigation). It now writes through `addToCart` like
 * every other marketplace surface.
 *
 * Spotlight items don't carry variants, but most products have them. The
 * store grid and product page add the first variant by default, so we resolve
 * the same default here; otherwise the same product would land as two
 * separate lines (`id:default` vs `id:<variant>`) with split quantities.
 */

/** The fields of a Spotlight item the cart needs (structural, so this stays UI-free). */
export interface SpotlightCartSource {
  store_id: string;
  store_name: string;
  store_slug?: string;
  store_category?: string;
  product: {
    id: string;
    title: string;
    price: number;
    compare_at_price?: number | null;
    image_url?: string | null;
  };
}

export interface SpotlightVariant {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number | null;
}

export type AddToCartInput = Omit<CartItem, "id" | "quantity" | "selected"> & { quantity?: number };

export function spotlightCartLine(item: SpotlightCartSource, variant?: SpotlightVariant | null): AddToCartInput {
  const p = item.product;
  return {
    productId: p.id,
    storeId: item.store_id,
    storeName: item.store_name,
    storeSlug: item.store_slug,
    title: p.title,
    variantId: variant?.id,
    variantTitle: variant?.title,
    price: variant?.price ?? p.price,
    compareAtPrice: (variant?.compare_at_price ?? p.compare_at_price) || undefined,
    imageUrl: p.image_url || undefined,
    category: item.store_category,
    quantity: 1,
  };
}

type FetchProduct = (id: string) => Promise<{ product?: { variants?: SpotlightVariant[] | null } | null } | null | undefined>;

/**
 * Adds a Spotlight product to the shared cart, using the product's default
 * (first) variant when it has one. If the lookup fails or is slow, the item is
 * still added (without a variant) so a tap on Buy is never lost.
 */
export async function addSpotlightItemToCart(
  item: SpotlightCartSource,
  fetchProduct?: FetchProduct,
  timeoutMs = 2500,
): Promise<AddToCartInput> {
  let variant: SpotlightVariant | null = null;
  if (fetchProduct) {
    try {
      const res = await Promise.race([
        fetchProduct(item.product.id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      variant = res?.product?.variants?.[0] ?? null;
    } catch {
      variant = null;
    }
  }
  const line = spotlightCartLine(item, variant);
  addToCart(line);
  return line;
}
