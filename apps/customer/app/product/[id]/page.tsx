import type { Metadata } from "next";
import { SharedItemGate } from "../../../components/SharedItemGate";
import { absoluteImage, fetchPublicProduct, jsonLd, productJsonLd, productPath, productText, SITE_URL, ugx } from "../../../lib/public-share";
import { ProductPageClient } from "./ProductPageClient";

type Props = { params: Promise<{ id: string }> };

/** Each product's own page: its title, description and image for search engines and link previews. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchPublicProduct(id);
  if (!product) return { title: "Product | Peebee", robots: { index: false } };
  const text = productText(product);
  const url = `${SITE_URL}${productPath(product.id)}`;
  const image = absoluteImage(product.image);
  return {
    title: text.title,
    description: text.description,
    alternates: { canonical: url },
    robots: product.status && product.status !== "active" ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: "Peebee",
      url,
      title: text.title,
      description: text.longDescription,
      images: [{ url: image, alt: product.title }],
      locale: "en_UG",
    },
    twitter: { card: "summary_large_image", title: text.title, description: text.longDescription, images: [image] },
    other: {
      "product:price:amount": String(product.price),
      "product:price:currency": "UGX",
      "product:availability": product.inStock ? "in stock" : "out of stock",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await fetchPublicProduct(id);
  if (!product) return <ProductPageClient />;
  const text = productText(product);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(product)) }} />
      <SharedItemGate
        preview={{
          kind: "product",
          path: productPath(product.id),
          title: product.title,
          seller: product.store?.name ?? null,
          price: ugx(product.price),
          image: product.image ? absoluteImage(product.image) : null,
          description: text.longDescription,
          details: [
            product.categoryName ? `Category: ${product.categoryName}` : "",
            product.variants.length > 1 ? `Options: ${product.variants.map((v) => `${v.title} (${ugx(v.price)})`).join(", ")}` : "",
            product.store?.address ? `Store: ${product.store.address}` : "",
          ].filter(Boolean),
          available: product.inStock,
          shareText: `${product.title} for ${ugx(product.price)}${product.store?.name ? ` at ${product.store.name}` : ""} on Peebee`,
        }}
      >
        <ProductPageClient />
      </SharedItemGate>
    </>
  );
}
