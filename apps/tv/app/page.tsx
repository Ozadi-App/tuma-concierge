"use client";

import { Launcher } from "../components/Launcher";
import { Pairing } from "../components/Pairing";
import { useDevice } from "../lib/device";

export default function Home() {
  const { state } = useDevice();
  if (state.phase === "starting") {
    return <main className="tv-safe flex min-h-screen items-center justify-center text-[1.6rem] text-ink-500">Starting…</main>;
  }
  if (state.phase === "pairing") return <Pairing code={state.code} />;
  return <Launcher name={state.name} ownerName={state.ownerName} />;
}
