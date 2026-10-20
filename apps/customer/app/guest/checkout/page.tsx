import { Suspense } from "react";
import { GuestCheckoutClient } from "./GuestCheckoutClient";

export const metadata = { title: "Checkout as a guest", robots: { index: false } };

export default function GuestCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <GuestCheckoutClient />
    </Suspense>
  );
}
