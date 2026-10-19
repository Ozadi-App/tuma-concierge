"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useDevice } from "../lib/device";
import { MODULES } from "../lib/modules";

/** Home: the modules this screen can open. */
export function Launcher({ name, ownerName }: { name: string; ownerName: string }) {
  const { unpair } = useDevice();
  const [confirming, setConfirming] = useState(false);
  const first = useRef<HTMLAnchorElement>(null);

  return (
    <main className="tv-safe flex min-h-screen flex-col">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-[1rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/peebee-logo-light.svg?v=logo-6" alt="" width={64} height={64} className="h-[3.4rem] w-[3.4rem]" />
          <p className="text-[1.6rem] font-black text-ink">Peebee TV</p>
        </div>
        <p className="text-[1.2rem] text-ink-500">
          {name} · connected to <strong className="text-ink">{ownerName}</strong>
        </p>
      </header>

      <section className="tv-fade-in flex flex-1 flex-col justify-center gap-[2.4rem]" aria-label="Modules">
        <h1 className="text-[3rem] font-black text-ink">What would you like to open?</h1>
        <ul className="flex flex-wrap gap-[1.6rem]">
          {MODULES.map((m, i) => (
            <li key={m.id}>
              <Link
                ref={i === 0 ? first : undefined}
                href={m.href}
                data-focusable
                autoFocus={i === 0}
                className="flex h-[17rem] w-[26rem] flex-col justify-between rounded-[1.6rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1.6rem] focus:bg-gold focus:text-ink-gold"
              >
                <m.icon className="h-[3.4rem] w-[3.4rem]" aria-hidden />
                <span>
                  <span className="block text-[2rem] font-black">{m.title}</span>
                  <span className="mt-1 block text-[1rem] leading-snug opacity-80">{m.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex items-center justify-between text-[1rem] text-ink-500">
        <p>Use the arrow keys to move and OK to choose. Press Back to return.</p>
        {confirming ? (
          <span className="flex items-center gap-[1rem]">
            Disconnect this screen from {ownerName}?
            <button type="button" data-focusable className="rounded-full bg-gold px-[1.2rem] py-[0.4rem] font-bold text-ink-gold" onClick={() => void unpair()}>
              Disconnect
            </button>
            <button type="button" data-focusable className="rounded-full border border-[var(--border-faint)] px-[1.2rem] py-[0.4rem] font-bold text-ink" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" data-focusable className="rounded-full border border-[var(--border-faint)] px-[1.2rem] py-[0.4rem] font-bold text-ink" onClick={() => setConfirming(true)}>
            Disconnect screen
          </button>
        )}
      </footer>
    </main>
  );
}
