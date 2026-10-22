import { inPractice } from "../db/practice-context.js";

/** Demo personas share the users and riders tables with real people; this is how the two are kept apart. */
export const PRACTICE_ID_LIKE = "prac\\_%";

export const isPracticeUserId = (id: string): boolean => id.startsWith("prac_");

/** SQL: only real people. For admin lists, counts and anything that reports on the live business. */
export const realPeopleOnly = (column: string): string => `${column} NOT LIKE '${PRACTICE_ID_LIKE}' ESCAPE '\\'`;

/**
 * SQL: the riders who may be offered or notified about the request in hand. Inside practice that is the demo riders and
 * only them, so a real rider is never pinged about a practice order; everywhere else it is every rider except the demo ones.
 */
export const ridersForThisWorld = (column: string): string =>
  inPractice() ? `${column} LIKE '${PRACTICE_ID_LIKE}' ESCAPE '\\'` : realPeopleOnly(column);

/** SQL for an admin list: the demo people show only while the admin is looking at the sandbox. */
export const demoPeopleFilter = (viewing: "live" | "sandbox", column: string): string => (viewing === "live" ? realPeopleOnly(column) : "1 = 1");
