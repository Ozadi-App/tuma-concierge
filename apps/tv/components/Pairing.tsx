"use client";

import { Qr } from "./JoinCard";

const LEARN_URL = (process.env.NEXT_PUBLIC_LEARN_URL ?? "https://learn.peebee.online").replace(/\/$/, "");

/** First run: a big code to type into Peebee Learn on a phone or computer. */
export function Pairing({ code }: { code: string | null }) {
  const url = code ? `${LEARN_URL}/screens?code=${code}` : LEARN_URL;
  return (
    <main className="tv-safe flex min-h-screen items-center justify-center">
      <div className="tv-fade-in grid w-full max-w-[84rem] grid-cols-[1fr_22rem] items-center gap-[4rem]">
        <section className="space-y-[2rem]">
          <p className="text-[1.1rem] font-bold uppercase tracking-[0.22em] text-gold">Peebee TV</p>
          <h1 className="text-[4.2rem] font-black leading-[1.05] text-ink">Connect this screen</h1>
          <ol className="space-y-[0.8rem] text-[1.7rem] leading-snug text-ink-500">
            <li>
              <strong className="text-ink">1.</strong> On your phone or computer, open <strong className="text-ink">Peebee Learn</strong>
            </li>
            <li>
              <strong className="text-ink">2.</strong> Go to <strong className="text-ink">Screens</strong> and choose <strong className="text-ink">Add a screen</strong>
            </li>
            <li>
              <strong className="text-ink">3.</strong> Type this code, or scan the picture
            </li>
          </ol>
          <p className="font-mono text-[7.5rem] font-black leading-none tracking-[0.18em] text-ink" aria-label={code ? `Code ${code.split("").join(" ")}` : "Getting a code"}>
            {code ?? "······"}
          </p>
          <p className="text-[1.1rem] text-ink-500">The code changes every few minutes. This screen connects by itself the moment you enter it.</p>
        </section>
        <Qr value={url} label="QR code that opens Peebee Learn's Add a screen page" className="aspect-square w-full" />
      </div>
    </main>
  );
}
