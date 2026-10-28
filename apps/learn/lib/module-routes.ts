import type { ModuleRouteRule } from "@peebee/shared";

/** Which screens belong to which Services module; a screen whose module is off shows Admin's notice instead. */
export const MODULE_ROUTES: ModuleRouteRule[] = [
  { prefix: "/classroom", module: "learn.live", title: "Live classes" },
  { prefix: "/live", module: "learn.live", title: "Live classes" },
];
