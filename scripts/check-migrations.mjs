// Guards the hand-applied D1 migrations: every file is NNNN_name.sql, files sort in
// the order they must run, and no *new* number is reused. A handful of numbers were
// already reused before this check existed; those stay allowed (their file names are
// distinct, so wrangler tracks them fine) but nothing else may join them.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../apps/api/src/db/migrations");
const KNOWN_REUSED = new Set(["0012", "0013", "0042", "0043", "0090"]);

const files = readdirSync(dir).filter((f) => !f.startsWith("."));
const problems = [];
const byNumber = new Map();

for (const f of files) {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) {
    problems.push(`${f}: must be named NNNN_snake_case.sql`);
    continue;
  }
  byNumber.set(m[1], [...(byNumber.get(m[1]) ?? []), f]);
}
for (const [n, list] of byNumber) {
  if (list.length > 1 && !KNOWN_REUSED.has(n)) problems.push(`number ${n} is used by ${list.join(", ")} — pick the next free number`);
}
const numbers = [...byNumber.keys()].map(Number).sort((a, b) => a - b);
for (let i = 1; i < numbers.length; i++) {
  if (numbers[i] - numbers[i - 1] > 1) problems.push(`gap in numbering between ${numbers[i - 1]} and ${numbers[i]}`);
}

if (problems.length) {
  console.error(`Migration check failed:\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`Migration check passed: ${files.length} files, latest ${numbers.at(-1)}.`);
