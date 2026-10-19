"use client";

import type { ReactNode } from "react";
import { useDpad } from "../lib/dpad";
import { DeviceProvider, useDevice } from "../lib/device";

function Offline() {
  const { offline } = useDevice();
  if (!offline) return null;
  return (
    <div role="status" className="fixed left-1/2 top-[2vh] z-50 -translate-x-1/2 rounded-full bg-gold px-[1.6rem] py-[0.6rem] text-[1.1rem] font-bold text-ink-gold">
      Can&apos;t reach Peebee. Trying again…
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  useDpad();
  return (
    <>
      <Offline />
      {children}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <DeviceProvider>
      <Frame>{children}</Frame>
    </DeviceProvider>
  );
}
