import { executeBatch, type DbStatement } from "../db/client.js";

/** Runs seed statements in slices D1 accepts. If a slice fails, finds the statement at fault so the error says which row. */
export async function runSeed(statements: DbStatement[], slice = 80): Promise<void> {
  for (let i = 0; i < statements.length; i += slice) {
    const part = statements.slice(i, i + slice);
    try {
      const changes = await executeBatch(part);
      // INSERT OR IGNORE also ignores a row that breaks a CHECK rule. When asked (tests), say which rows did not go in.
      if (process.env.PRACTICE_SEED_REPORT) part.forEach((st, k) => { if (changes[k] === 0 && /^INSERT OR IGNORE/.test(st.sql)) console.log("SEED-IGNORED", st.sql.replace(/\s+/g, " ").slice(0, 70), JSON.stringify(st.args).slice(0, 80)); });
    } catch (err) {
      for (const st of part) {
        try { await executeBatch([st]); } catch (inner) {
          throw new Error(`Practice seed failed on: ${st.sql.replace(/\s+/g, " ").slice(0, 120)} ${JSON.stringify(st.args).slice(0, 160)} (${inner instanceof Error ? inner.message : inner})`);
        }
      }
      throw err;
    }
  }
}
