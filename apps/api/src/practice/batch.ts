import { executeBatch, type DbStatement } from "../db/client.js";

/** Runs seed statements in slices D1 accepts. If a slice fails, finds the statement at fault so the error says which row. */
export async function runSeed(statements: DbStatement[], slice = 80): Promise<void> {
  for (let i = 0; i < statements.length; i += slice) {
    const part = statements.slice(i, i + slice);
    try {
      await executeBatch(part);
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
