import { test } from "node:test";
import assert from "node:assert/strict";
import { COLOUR_SCENES } from "../../../packages/shared/src/colour-scenes";
import { storefrontTokens, storefrontChecks } from "../../../packages/shared/src/storefront-palette";

for (const s of COLOUR_SCENES as readonly any[]) {
  const scene = typeof s === "string" ? s : s.id ?? s.key;
  for (const mode of ["light", "dark"] as const) {
    test(`${scene} ${mode} storefront palette meets WCAG AA`, () => {
      for (const c of storefrontChecks(storefrontTokens(scene, mode))) {
        assert.ok(c.ratio >= c.min, `${c.name}: ${c.ratio.toFixed(2)} < ${c.min}`);
      }
    });
  }
}
