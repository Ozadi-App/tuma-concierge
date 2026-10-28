import type { ModuleRouteRule } from "@peebee/shared";

/** Which screens belong to which Services module; a screen whose module is off shows Admin's notice instead. */
export const MODULE_ROUTES: ModuleRouteRule[] = [
  { prefix: "/", module: "buy.food", title: "Orders", exact: true },
  { prefix: "/menu", module: "buy.food", title: "Menu" },
];
