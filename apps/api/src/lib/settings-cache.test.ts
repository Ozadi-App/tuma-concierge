import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type InArgs } from "@libsql/client/node";
import { setD1Binding, type D1Database } from "../db/client.js";

test("settings are read as one cached snapshot, and a save shows up straight away", async () => {
  process.env.SETTINGS_CACHE_TTL_MS = "60000"; // read when the module loads, so import it afterwards
  const { getSetting, setSetting, invalidateSettingsCache } = await import("./settings.js");
  const client = createClient({ url: "file::memory:" });
  let selects = 0;
  try {
    await client.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)");
    await client.execute("INSERT INTO settings (key, value) VALUES ('relay_enabled', '1')");
    const prepare = (sql: string) => ({
      sql, args: [] as unknown[],
      bind(...args: unknown[]) { this.args = args; return this; },
      async all() {
        if (/^\s*SELECT/i.test(this.sql)) selects++;
        const r = await client.execute({ sql: this.sql, args: this.args as InArgs });
        return { results: r.rows, success: true, meta: { changes: r.rowsAffected, last_row_id: Number(r.lastInsertRowid ?? 0) } };
      },
    });
    setD1Binding({ prepare } as unknown as D1Database);
    invalidateSettingsCache();

    assert.equal(await getSetting("relay_enabled"), "1");
    assert.equal(await getSetting("learn_max_cover_mb"), "2", "a key with no row falls back to its default");
    await Promise.all([getSetting("relay_enabled"), getSetting("platform_environment"), getSetting("relay_enabled")]);
    assert.equal(selects, 1, "dozens of reads cost one query");

    await client.execute("UPDATE settings SET value = '0' WHERE key = 'relay_enabled'");
    assert.equal(await getSetting("relay_enabled"), "1", "a raw write is hidden until the cache expires or is cleared");
    invalidateSettingsCache();
    assert.equal(await getSetting("relay_enabled"), "0");

    await setSetting("relay_enabled", "1");
    assert.equal(await getSetting("relay_enabled"), "1", "setSetting clears the cache");
  } finally { setD1Binding(undefined); client.close(); }
});
