"use client";

import { useEffect, useState } from "react";
import { loadMapTiles } from "../../../lib/map-tiles";
import { loadPlaces } from "../../../lib/places";
import { useTranslate } from "../../../lib/i18n";
import type { HomeFeature } from "../../../lib/home-catalog";
import { LocationOnboarding } from "../LocationOnboarding";
import { ParcelModal } from "../ParcelModal";
import { RideModal } from "../RideModal";
import { ShoppingListModal } from "../ShoppingListModal";
import { ArrangeHomeButton } from "./ArrangeHomeButton";
import { HomeFeatureRow, HomeTile } from "./HomeFeature";
import { HomeRecent } from "./HomeRecent";
import { HomeSection, HomeStatus } from "./HomeSection";
import { HomeWallet } from "./HomeWallet";
import { HomeWelcome } from "./HomeWelcome";
import { NeedsYou } from "./NeedsYou";
import { useHomeCatalog } from "./useHomeCatalog";

type Sheet = "list" | "boda" | "parcel";

export function HomeScreen() {
  const t = useTranslate();
  const { start, more } = useHomeCatalog();
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

  return (
    <div className="space-y-8 px-4 pb-6 pt-2">
      <HomeWelcome />
      <NeedsYou />
      <HomeSection title={t("home_start_here")}>
        {start.length === 0 ? (
          <HomeStatus kind="empty" title={t("home_nothing_on")} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {start.map((feature) => (
              <HomeTile key={feature.id} feature={feature} onSelect={open} />
            ))}
          </div>
        )}
      </HomeSection>
      {more.length > 0 && (
        <HomeSection title={t("home_also")}>
          <ul className="divide-y divide-[var(--border-faint)]">
            {more.map((feature) => (
              <li key={feature.id}>
                <HomeFeatureRow feature={feature} onSelect={open} />
              </li>
            ))}
          </ul>
        </HomeSection>
      )}
      <HomeWallet />
      <HomeRecent />
      <ArrangeHomeButton />
      <LocationOnboarding />
      {sheet === "list" && <ShoppingListModal onClose={() => setSheet(null)} />}
      {sheet === "boda" && <RideModal initialMode="boda" onClose={() => setSheet(null)} />}
      {sheet === "parcel" && <ParcelModal onClose={() => setSheet(null)} />}
    </div>
  );
}
