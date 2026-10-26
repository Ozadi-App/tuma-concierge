import type { Metadata } from "next";
import PurchaseClient from "./PurchaseClient";

// A purchase link is private: never indexed, never cached, and the address is not sent on to other sites.
export const metadata: Metadata = {
  title: "Your purchase",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PurchasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PurchaseClient token={token} />;
}
