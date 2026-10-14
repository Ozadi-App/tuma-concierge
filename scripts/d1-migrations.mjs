// Tracked D1 migrations. Until now migrations were applied by hand with nothing
// recording which had run. This wraps wrangler's own tracking (the d1_migrations
// table, configured by migrations_dir in apps/api/wrangler.jsonc).
//
//   node scripts/d1-migrations.mjs status            pending migrations on the live DB
//   node scripts/d1-migrations.mjs baseline <file>   print SQL that marks everything up to
//                                                    <file> as already applied (run ONCE)
//   node scripts/d1-migrations.mjs apply             apply pending migrations to the live DB
//
// `baseline` only prints; it never touches the database. Review it, then run it with
// `wrangler d1 execute peebee-api --remote --file <printed.sql>`.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "apps/api");
const dir = join(api, "src/db/migrations");
const [cmd, arg] = process.argv.slice(2);

const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { cwd: api, stdio: "inherit" });

if (cmd === "status") {
  wrangler(["d1", "migrations", "list", "DB", "--remote"]);
} else if (cmd === "apply") {
  wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
} else if (cmd === "baseline") {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (!arg || !files.includes(arg)) {
    console.error(`Usage: baseline <last-applied-file>. Latest on disk: ${files.at(-1)}`);
    process.exit(1);
  }
  const done = files.slice(0, files.indexOf(arg) + 1);
  console.log(
    [
      "-- Marks migrations that were applied by hand as applied, so tracked apply skips them.",
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);",
      ...done.map((f) => `INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${f}');`),
    ].join("\n"),
  );
} else {
  console.error("Usage: d1-migrations.mjs status | apply | baseline <file>");
  process.exit(1);
}
