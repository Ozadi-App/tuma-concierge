import type { Metadata } from "next";
import { SharedItemGate } from "../../../../../components/SharedItemGate";
import { absoluteImage, dishJsonLd, dishPath, dishText, fetchPublicDish, jsonLd, SITE_URL, ugx } from "../../../../../lib/public-share";
import RestaurantPage from "../../page";

type Props = { params: Promise<{ id: string; itemId: string }> };

/** Each dish's own page: its title, description and photo for search engines and link previews. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, itemId } = await params;
  const dish = await fetchPublicDish(id, itemId);
  if (!dish) return { title: "Peebee Food", robots: { index: false } };
  const text = dishText(dish);
  const url = `${SITE_URL}${dishPath(id, itemId)}`;
  const image = absoluteImage(dish.item.photo);
  return {
    title: text.title,
    description: text.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Peebee Food",
      url,
      title: text.title,
      description: text.longDescription,
      images: [{ url: image, alt: `${dish.item.name} from ${dish.restaurant.name}` }],
      locale: "en_UG",
    },
    twitter: { card: "summary_large_image", title: text.title, description: text.longDescription, images: [image] },
    other: {
      "product:price:amount": String(dish.item.price),
      "product:price:currency": "UGX",
      "product:availability": dish.item.available ? "in stock" : "out of stock",
    },
  };
}

export default async function DishPage({ params }: Props) {
  const { id, itemId } = await params;
  const dish = await fetchPublicDish(id, itemId);
  if (!dish) return <RestaurantPage />;
  const text = dishText(dish);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(dishJsonLd(dish)) }} />
      <SharedItemGate
        preview={{
          kind: "dish",
          path: dishPath(id, itemId),
          title: dish.item.name,
          seller: dish.restaurant.name,
          price: ugx(dish.item.price),
          image: dish.item.photo ? absoluteImage(dish.item.photo) : null,
          description: text.longDescription,
          details: [
            dish.item.prepTimeMinutes ? `Ready in about ${dish.item.prepTimeMinutes} minutes` : "",
            ...dish.item.options.filter((o) => o.choices.length).map((o) =>
              `${o.name}${o.required ? "" : " (optional)"}: ${o.choices.map((c) => (c.priceDelta > 0 ? `${c.name} +${ugx(c.priceDelta)}` : c.name)).join(", ")}`),
            dish.restaurant.address ? `${dish.restaurant.name}: ${dish.restaurant.address}` : "",
          ].filter(Boolean),
          available: dish.item.available,
          shareText: `${dish.item.name} from ${dish.restaurant.name}, ${ugx(dish.item.price)} on Peebee Food`,
        }}
      >
        <RestaurantPage />
      </SharedItemGate>
    </>
  );
}
