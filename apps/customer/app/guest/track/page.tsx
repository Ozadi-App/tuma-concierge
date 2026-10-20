import { Suspense } from "react";
import { GuestTrackClient } from "./GuestTrackClient";

export const metadata = { title: "Track your order", robots: { index: false } };

export default function GuestTrackPage() {
  return (
    <Suspense fallback={null}>
      <GuestTrackClient />
    </Suspense>
  );
}
