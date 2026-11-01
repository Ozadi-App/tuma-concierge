"use client";

import type { HomeClusterId, HomeFeature, HomeFeatureId } from "../../../lib/home-catalog";
import { selectHomeFeatures } from "../../../lib/home-catalog";
import { useHireAvailability, useHomeMenu } from "../../../lib/home-menu";
import { useTranslate, type TranslationKey } from "../../../lib/i18n";
import { useModules } from "../../../lib/modules";
import { useSpecialCarServices } from "../../../lib/special-car";
import { useTaxipress } from "../../../lib/taxipress";

const COPY_KEYS: Record<HomeFeatureId, { label: TranslationKey; detail: TranslationKey }> = {
  "shopping-list": { label: "home_feature_list", detail: "home_feature_list_detail" },
  list: { label: "home_feature_menu_list", detail: "home_feature_menu_list_detail" },
  boda: { label: "home_feature_boda", detail: "home_feature_boda_detail" },
  food: { label: "home_feature_food", detail: "home_feature_food_detail" },
  parcel: { label: "home_feature_parcel", detail: "home_feature_parcel_detail" },
  groceries: { label: "home_feature_groceries", detail: "home_feature_groceries_detail" },
  car: { label: "home_feature_car", detail: "home_feature_car_detail" },
  stores: { label: "home_feature_stores", detail: "home_feature_stores_detail" },
  pharmacy: { label: "home_feature_pharmacy", detail: "home_feature_pharmacy_detail" },
  orders: { label: "home_feature_orders", detail: "home_feature_orders_detail" },
  restaurants: { label: "home_feature_restaurants", detail: "home_feature_eat_detail" },
  kitchens: { label: "home_feature_kitchens", detail: "home_feature_eat_detail" },
  streetfood: { label: "home_feature_streetfood", detail: "home_feature_eat_detail" },
  juices: { label: "home_feature_juices", detail: "home_feature_eat_detail" },
  bakeries: { label: "home_feature_bakeries", detail: "home_feature_eat_detail" },
  clean: { label: "home_feature_clean", detail: "home_feature_work_detail" },
  laundry: { label: "home_feature_laundry", detail: "home_feature_work_detail" },
  fix: { label: "home_feature_fix", detail: "home_feature_work_detail" },
  "my-class": { label: "home_feature_my_class", detail: "home_feature_learn_item_detail" },
  live: { label: "home_feature_live", detail: "home_feature_learn_item_detail" },
  tv: { label: "home_feature_tv", detail: "home_feature_learn_item_detail" },
  discover: { label: "home_feature_discover", detail: "home_feature_learn_detail" },
  connect: { label: "home_feature_connect", detail: "home_feature_learn_item_detail" },
  move: { label: "home_feature_move", detail: "home_feature_move_detail" },
  rideshare: { label: "home_feature_rideshare", detail: "home_feature_rideshare_detail" },
  selfdrive: { label: "home_feature_selfdrive", detail: "home_feature_selfdrive_detail" },
  workers: { label: "home_feature_workers", detail: "home_feature_workers_detail" },
  hire: { label: "home_feature_hire", detail: "home_feature_hire_detail" },
  luxury: { label: "home_feature_luxury", detail: "home_feature_luxury_detail" },
  ambulance: { label: "home_feature_ambulance", detail: "home_feature_ambulance_detail" },
  taxipress: { label: "home_feature_taxipress", detail: "home_feature_taxipress_detail" },
};

export function useHomeCatalog(): { start: HomeFeature[]; clusters: ReturnType<typeof selectHomeFeatures>["clusters"] } {
  const t = useTranslate();
  const moduleOn = useModules();
  const menu = useHomeMenu();
  const special = useSpecialCarServices();
  const taxipress = useTaxipress();
  const hire = useHireAvailability();
  const copy = Object.fromEntries(
    (Object.keys(COPY_KEYS) as HomeFeatureId[]).map((id) => [id, { label: t(COPY_KEYS[id].label), detail: t(COPY_KEYS[id].detail) }]),
  ) as Record<HomeFeatureId, { label: string; detail: string }>;
  const clusterLabels: Record<HomeClusterId, string> = {
    ride: menu.clusters.ride.label,
    buy: menu.clusters.shopping.label,
    eat: menu.clusters.food.label,
    learn: menu.clusters.learn.label,
    work: menu.clusters.hive.label,
  };

  return selectHomeFeatures({
    moduleOn,
    copy,
    hiveShortcuts: menu.hive.shortcuts,
    clusterLabels,
    hire,
    special,
    taxipress: taxipress.enabled,
  });
}
