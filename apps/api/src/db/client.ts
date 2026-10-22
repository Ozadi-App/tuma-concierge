import { createClient, type Client, type InArgs } from "@libsql/client/web";
import { inPractice } from "./practice-context.js";

/**
 * Primary DB is Cloudflare D1 (native Worker binding — no HTTP hop, no
 * separate provider). Turso stays supported as a fallback purely for local
 * Node dev (`pnpm --filter api dev`), since a D1 binding only exists inside
 * a Worker. worker.ts registers the D1 binding via `setD1Binding` before
 * each request; if none is registered we fall back to
 * TURSO_DATABASE_URL/TURSO_AUTH_TOKEN (e.g. a local `turso dev` instance).
 *
 * Built lazily (on first query, not at import time) because on Workers the
 * D1 binding / env vars are only available once a request comes in, not at
 * module-load/cold-start time.
 */

type D1Result<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number };
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

export type DbStatement = { sql: string; args?: unknown[] };

let d1Binding: D1Database | null = null;

let practiceBinding: D1Database | null = null;

/** Called with the PRACTICE_DB binding. Without one, practice is simply unavailable; it never falls back to live. */
export function setPracticeBinding(binding: D1Database | undefined): void {
  practiceBinding = binding ?? null;
}

export class PracticeUnavailableError extends Error {
  constructor() { super("The practice database is not set up."); }
}

export function practiceAvailable(): boolean {
  return Boolean(practiceBinding) || Boolean(process.env.PRACTICE_TURSO_DATABASE_URL);
}

let cachedPracticeTurso: Client | null = null;
function practiceClient(): Client {
  if (practiceBinding) return wrapD1(practiceBinding);
  const url = process.env.PRACTICE_TURSO_DATABASE_URL;
  if (!url) throw new PracticeUnavailableError();
  cachedPracticeTurso ??= createClient({ url, authToken: process.env.PRACTICE_TURSO_AUTH_TOKEN });
  return cachedPracticeTurso;
}

/** Called once per request from worker.ts before any route handler runs. */
export function setD1Binding(binding: D1Database | undefined): void {
  d1Binding = binding ?? null;
}

function wrapD1(binding: D1Database): Client {
  return {
    async execute(query: { sql: string; args?: unknown[] } | string) {
      const { sql, args } = typeof query === "string" ? { sql: query, args: [] as unknown[] } : query;
      const stmt = binding.prepare(sql).bind(...(args ?? []));
      const res = await stmt.all();
      return {
        rows: res.results,
        columns: [],
        columnTypes: [],
        rowsAffected: res.meta.changes,
        lastInsertRowid: BigInt(res.meta.last_row_id ?? 0),
        toJSON() {
          return this;
        },
      };
    },
  } as unknown as Client;
}

function buildTursoClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "No D1 binding and TURSO_DATABASE_URL is not set. Copy .env.example to .env.local for local dev (see apps/api/README.md).",
    );
  }

  return createClient({ url, authToken });
}

let cachedTurso: Client | null = null;

function client(): Client {
  if (inPractice()) return practiceClient();
  return liveClient();
}

function liveClient(): Client {
  if (d1Binding) return wrapD1(d1Binding);
  if (!cachedTurso) cachedTurso = buildTursoClient();
  return cachedTurso;
}

export const db: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = Reflect.get(client(), prop, receiver);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});

/** The live database, even from inside a practice request. For admin configuration and nothing that belongs to a person. */
export const liveDb: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = Reflect.get(liveClient(), prop, receiver);
    return typeof value === "function" ? value.bind(liveClient()) : value;
  },
});

/**
 * Execute a set of writes atomically. D1 guarantees that `batch` either
 * commits every prepared statement or rolls the whole batch back; libSQL's
 * write batch provides the same property for local development. Financial
 * services use this instead of a sequence of independent `db.execute`
 * calls so a crash can never leave only half of a ledger transaction.
 */
export async function executeBatch(statements: DbStatement[]): Promise<number[]> {
  if (statements.length === 0) return [];
  const target = inPractice() ? practiceBinding : d1Binding;
  if (inPractice() && !practiceBinding && !process.env.PRACTICE_TURSO_DATABASE_URL) throw new PracticeUnavailableError();
  if (target) {
    const prepared = statements.map((statement) =>
      target.prepare(statement.sql).bind(...(statement.args ?? [])),
    );
    const results = await target.batch(prepared);
    return results.map((result) => result.meta.changes);
  }
  const results = await client().batch(
    statements.map((statement) => ({ sql: statement.sql, args: (statement.args ?? []) as InArgs })),
    "write",
  );
  return results.map((result) => result.rowsAffected);
}
