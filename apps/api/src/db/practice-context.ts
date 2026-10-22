import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which database a request talks to. Requests made with a practice session token run inside `runInPractice`, and every
 * query they make (through `db` or `executeBatch`) goes to the practice database. Nothing else changes: the same routes,
 * the same rules, a different set of rows. The live database is never reachable from inside this context except through
 * `liveDb`, which only configuration reads use.
 */
const store = new AsyncLocalStorage<true>();

export const inPractice = (): boolean => store.getStore() === true;
export const runInPractice = <T>(fn: () => T): T => store.run(true, fn);
/** Run something against the live database even when called from a practice request (settings, schema probes). */
export const runInLive = <T>(fn: () => T): T => store.exit(fn);
