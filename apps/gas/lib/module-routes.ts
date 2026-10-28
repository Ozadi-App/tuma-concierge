import type { ModuleRouteRule } from "@peebee/shared";

/** Which screens belong to which Services module; a screen whose module is off shows Admin's notice instead. */
export const MODULE_ROUTES: ModuleRouteRule[] = [
  { prefix: "/", module: "buy.gas", title: "Pump", exact: true },
  { prefix: "/dispense", module: "buy.gas", title: "Pump" },
  { prefix: "/prices", module: "buy.gas", title: "Prices" },
  { prefix: "/manager", module: "buy.gas", title: "Manager" },
  { prefix: "/shift", module: "buy.gas", title: "Shift" },
  { prefix: "/stations", module: "buy.gas", title: "Stations" },
  { prefix: "/parcels", module: "deliver.relay", title: "Parcels" },
];
