import type { ModuleRouteRule } from "@peebee/shared";

/** Which screens belong to which Services module; a screen whose module is off shows Admin's notice instead. */
export const MODULE_ROUTES: ModuleRouteRule[] = [
  { prefix: "/prescriptions", module: "buy.pharmacy", title: "Rx Review" },
  { prefix: "/inventory", module: "buy.pharmacy", title: "Medicines" },
];
