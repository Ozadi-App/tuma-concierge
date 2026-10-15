/** Card pricing shared by the marketplace grids (store page, /groceries, /stores). */

export type MarketVariant = {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number | null;
};

/** The option added by default (store grid, product page): the first one. */
export function defaultVariant(product: { variants?: MarketVariant[] | null }): MarketVariant | undefined {
  return product.variants?.[0] ?? undefined;
}

/**
 * What a card should show as its price. When a product's options have
 * different prices (or the default option's price differs from the listed
 * price) the card shows "from <lowest option price>", so the number on the card
 * is never higher than what can be bought. A strike price is only kept when it
 * belongs to that same option; otherwise it would compare unlike things.
 */
export function productPricing(product: { price: number; compare_at_price?: number | null; variants?: MarketVariant[] | null }): {
  price: number;
  from: boolean;
  compareAt: number | null;
  discount: number;
} {
  const variants = (product.variants ?? []).filter((v) => Number.isFinite(Number(v.price)));
  const prices = variants.map((v) => Number(v.price));
  const varying = prices.length > 0 && (new Set(prices).size > 1 || prices[0] !== Number(product.price));
  let price = Number(product.price);
  let compareAt = product.compare_at_price != null ? Number(product.compare_at_price) : null;
  if (varying) {
    const cheapest = variants.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
    price = Number(cheapest.price);
    compareAt = cheapest.compare_at_price != null ? Number(cheapest.compare_at_price) : null;
  }
  if (compareAt != null && !(compareAt > price)) compareAt = null;
  const discount = compareAt ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  return { price, from: varying, compareAt, discount };
}
