"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useBack } from "./dpad";

type Router = ReturnType<typeof useRouter>;

/** One step back if there is a step to go back to, otherwise `fallback` (a screen opened directly has no history). */
export function stepBack(router: Router, fallback: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) router.back();
  else router.push(fallback);
}

/** Back on the remote does `stepBack`. Returns the same action for an on-screen Back button. */
export function useGoBack(fallback = "/"): () => void {
  const router = useRouter();
  const goBack = useCallback(() => stepBack(router, fallback), [router, fallback]);
  useBack(goBack);
  return goBack;
}
