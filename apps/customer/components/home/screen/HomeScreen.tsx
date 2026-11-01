"use client";

import { useEffect, useState } from "react";
import { loadMapTiles } from "../../../lib/map-tiles";
import { loadPlaces } from "../../../lib/places";
import type { HomeFeature } from "../../../lib/home-catalog";
import { LocationOnboarding } from "../LocationOnboarding";
import { ParcelModal } from "../ParcelModal";
import { RideModal } from "../RideModal";
import { ShoppingListModal } from "../ShoppingListModal";
import { ArrangeHomeButton } from "./ArrangeHomeButton";
import { HomeRecent } from "./HomeRecent";
import { HomeWallet } from "./HomeWallet";
import { NeedsYou } from "./NeedsYou";
import { BrandHome, HomeVariantSwitch, LauncherHome, TodayHome, useHomeVariant } from "./HomeVariants";
import { useHomeCatalog } from "./useHomeCatalog";

type Sheet = "list" | "boda" | "parcel";

export function HomeScreen() {
  const { start, more } = useHomeCatalog();
  const { variant, reviewing } = useHomeVariant();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    void loadPlaces();
    void loadMapTiles();
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 600));
    idle(() => {
      void import("../../maps/PlaceMap");
      void import("../../PlaceFlow");
    });
  }, []);

  function open(feature: HomeFeature) {
    if (feature.action) setSheet(feature.action);
  }

  const layout = variant === "b"
    ? <LauncherHome start={start} more={more} onSelect={open} />
    : variant === "c"
      ? <TodayHome start={start} more={more} onSelect={open} />
      : <BrandHome start={start} more={more} onSelect={open} />;

  return (
    <div data-home-variant={variant} className="space-y-8 px-4 pb-6 pt-2">
      <NeedsYou />
      {layout}
      <HomeWallet />
      <HomeRecent />
      <ArrangeHomeButton />
      {reviewing && <HomeVariantSwitch current={variant} />}
      <LocationOnboarding />
      {sheet === "list" && <ShoppingListModal onClose={() => setSheet(null)} />}
      {sheet === "boda" && <RideModal initialMode="boda" onClose={() => setSheet(null)} />}
      {sheet === "parcel" && <ParcelModal onClose={() => setSheet(null)} />}
    </div>
  );
}
