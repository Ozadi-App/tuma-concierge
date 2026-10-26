import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Practice is the sandbox, seen by one person at a time. A request made with a practice session token runs inside
 * `runInPractice`: the platform environment reads as "sandbox" for that request only, so it reads and writes the same
 * demo data the platform-wide Sandbox switch shows everyone. The database is the same one; nothing is copied.
 *
 * Demo people are told apart by their `prac_` ids. See practice/people.ts for how live traffic keeps clear of them.
 */
const store = new AsyncLocalStorage<true>();

export const inPractice = (): boolean => store.getStore() === true;
export const runInPractice = <T>(fn: () => T): T => store.run(true, fn);
