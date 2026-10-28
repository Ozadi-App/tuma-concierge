import type { ModuleRouteRule } from "@peebee/shared";

/** Which screens belong to which Services module; a screen whose module is off shows Admin's notice instead. */
export const MODULE_ROUTES: ModuleRouteRule[] = [
  { prefix: "/jobs", module: "ride.car", title: "Jobs" },
  { prefix: "/trips", module: "ride.car", title: "Trips" },
  { prefix: "/vehicles", module: "ride.car", title: "Vehicles" },
  { prefix: "/rentals", module: "ride.car.selfdrive", title: "Rentals" },
  { prefix: "/taxipress", module: "ride.taxipress", title: "Taxipress" },
  { prefix: "/relay", module: "deliver.relay", title: "Relay" },
];
