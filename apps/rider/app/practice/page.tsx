"use client";

import { launchPractice } from "@peebee/shared";
import { useEffect } from "react";

export default function PracticeEntryPage() {
  useEffect(() => { void launchPractice("rider").then((path) => window.location.replace(path)); }, []);
  return <p className="p-5 text-sm text-ink-500">Opening the real rider app with safe practice data…</p>;
}
