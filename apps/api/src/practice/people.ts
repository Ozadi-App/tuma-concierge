import { inPractice } from "../db/practice-context.js";

/**
 * Demo people share the users and riders tables with real ones; their ids say which they are. `prac_` is the practice
 * world's own people; the others are the older sandbox demos (Work, Hire, Learn, the Car and Relay drivers).
 */
const DEMO_ID_PREFIXES = ["prac_", "wdemo_", "talent_demo_", "usr_demo_", "demo-car-driver-", "demo-relay-"] as const;

const like = (prefix: string): string => `'${prefix.replace(/[_%\\]/g, (c) => `\\${c}`)}%' ESCAPE '\\'`;

/** The pattern for the practice world's own people. */
export const PRACTICE_ID_LIKE = "prac\\_%";

export const isPracticeUserId = (id: string): boolean => id.startsWith("prac_");
export const isDemoUserId = (id: string): boolean => DEMO_ID_PREFIXES.some((p) => id.startsWith(p));

/** SQL: only real people. For admin lists, counts and anything that reports on the live business. */
export const realPeopleOnly = (column: string): string => DEMO_ID_PREFIXES.map((p) => `${column} NOT LIKE ${like(p)}`).join(" AND ");

/** SQL: demo people only. */
export const demoPeopleOnly = (column: string): string => `(${DEMO_ID_PREFIXES.map((p) => `${column} LIKE ${like(p)}`).join(" OR ")})`;

/**
 * SQL: the riders who may be offered or notified about the request in hand. Inside practice that is the practice
 * world's riders and only them, so a real rider is never pinged about a practice order; everywhere else it is every
 * rider except the demo ones.
 */
export const ridersForThisWorld = (column: string): string =>
  inPractice() ? `${column} LIKE ${like("prac_")}` : realPeopleOnly(column);

/** SQL for an admin list: demo people show only while the admin is looking at the sandbox. */
export const demoPeopleFilter = (viewing: "live" | "sandbox", column: string): string => (viewing === "live" ? realPeopleOnly(column) : "1 = 1");

/**
 * SQL for shared fleet and configuration rows that carry no environment of their own (vehicles, taxi routes, fuel
 * stations, relay routes). Real rows show in the live platform; demo rows show in the sandbox and in practice.
 */
export const visibleInWorld = (viewing: "live" | "sandbox", column: string): string =>
  inPractice() ? demoPeopleOnly(column) : viewing === "live" ? realPeopleOnly(column) : "1 = 1";
