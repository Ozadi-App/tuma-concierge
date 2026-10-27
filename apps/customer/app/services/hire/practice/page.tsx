"use client";

import { launchPractice } from "@peebee/shared";
import { useEffect } from "react";

/** Starts practice mode with sample Jobs data, then opens the Jobs hub. Nothing here touches the live account. */
export default function JobsPracticePage() {
  useEffect(() => {
    void launchPractice("customer").then(() => window.location.replace("/services/hire"));
  }, []);
  return <p className="px-4 py-16 text-center text-sm text-ink-500">Opening practice mode with sample jobs…</p>;
}
