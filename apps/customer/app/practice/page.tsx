"use client";

import { launchPractice } from "@peebee/shared";
import { useEffect } from "react";

export default function PracticeEntryPage() {
  useEffect(() => { void launchPractice("customer").then((path) => window.location.replace(path)); }, []);
  return <p className="p-5 text-sm text-ink-500">Opening the real customer app with safe practice data…</p>;
}
