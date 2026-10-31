import assert from "node:assert/strict";
import test from "node:test";
import { MODULES, WEBSITE_SECTIONS } from "@peebee/shared";
import { DEFAULT_DOORS } from "../../web/lib/door-ids.ts";
import { DOOR_MODULE, PARTNER_MODULE, SUB_MODULE, moduleOfPartner, moduleOfSub } from "../../web/lib/module-map.ts";
import { PARTNER_TYPES } from "../../web/lib/partners.ts";
import { SUBS } from "../../web/lib/subs.ts";

test("every module the website follows exists, and Admin's list of what it reaches matches the site", () => {
  const known = new Set(MODULES.map((m) => m.key));
  for (const key of [...Object.values(DOOR_MODULE), ...Object.values(SUB_MODULE), ...Object.values(PARTNER_MODULE)]) {
    assert.ok(known.has(key), `the website follows ${key}, which is not a module`);
  }

  const expected: Record<string, string[]> = {};
  const add = (k: string, label: string) => { (expected[k] ??= []).push(label); };
  for (const d of DEFAULT_DOORS) add(DOOR_MODULE[d.id], `${d.label} door`);
  for (const s of SUBS) add(moduleOfSub(s.door, s.key), `${s.chip ?? s.title} page`);
  for (const p of PARTNER_TYPES) add(moduleOfPartner(p.slug, p.door), `${p.short} partner page`);
  assert.deepEqual(WEBSITE_SECTIONS, expected, "packages/shared/src/website-sections.ts is out of step with apps/web (module-map, subs, partners)");
});
