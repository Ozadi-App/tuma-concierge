"use client";

import { ServerPracticeCard } from "@peebee/shared/practice-ui";
import { api } from "../lib/api";

/** Practice for owners and drivers: the real Partner app, signed in as a demo partner on the shared practice world. */
export function CarPracticeDemo({ mode }: { mode: "owner" | "driver" }) {
  return (
    <ServerPracticeCard
      role="partner"
      api={api}
      body={mode === "owner"
        ? "See the app as a demo owner: cars to manage, drivers, rentals and earnings, with demo customers booking rides. Your own account isn't touched."
        : "See the app as a demo driver: ride requests from demo customers, carpool trips and a place in the taxi line. Your own account isn't touched."}
      buttonLabel={`Practise as ${mode === "owner" ? "an owner" : "a driver"}`}
    />
  );
}
