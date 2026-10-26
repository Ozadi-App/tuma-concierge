import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Migrations are applied by hand, in file order. These numbers were already shared by two files before the check
// existed (both applied long ago); no new number may be reused, because the order between two files with the same
// number is only the alphabetical accident of their names.
const KNOWN_SHARED = new Set(["0012", "0013", "0042", "0043", "0090", "0107", "0132"]);

test("migration numbers are not reused, and the Tier 3 hardening migrations are in order", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const seen = new Map<string, string[]>();
  for (const f of files) seen.set(f.slice(0, 4), [...(seen.get(f.slice(0, 4)) ?? []), f]);
  const reused = [...seen.entries()].filter(([n, list]) => list.length > 1 && !KNOWN_SHARED.has(n)).map(([n]) => n);
  assert.deepEqual(reused, [], "pick the next free migration number");
  for (const n of ["0137", "0138", "0139", "0140"]) assert.equal(seen.get(n)?.length, 1, `${n} exists once`);
});
