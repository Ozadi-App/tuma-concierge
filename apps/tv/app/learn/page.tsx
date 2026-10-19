"use client";

import type { ScreenState } from "@peebee/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { JoinCard } from "../../components/JoinCard";
import { StageCue } from "../../components/Stage";
import { TvAuthError, tvApi } from "../../lib/api";
import { useDevice } from "../../lib/device";
import { useBack } from "../../lib/dpad";
import { useServerClock } from "../../lib/time";

/** The classroom: shows whatever the tutor has pushed to this screen. */
export default function LearnPage() {
  const router = useRouter();
  const { state: device, secret, lost, pollSeconds } = useDevice();
  const [screen, setScreen] = useState<ScreenState | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const now = useServerClock(screen?.serverNow);
  const goHome = useCallback(() => router.push("/"), [router]);
  useBack(goHome);

  // Any key press counts as the "tap" some TVs need before they allow sound.
  useEffect(() => {
    const on = () => setSoundOn(true);
    window.addEventListener("keydown", on, { once: true });
    return () => window.removeEventListener("keydown", on);
  }, []);

  const interval = useRef(pollSeconds);
  interval.current = screen?.pollSeconds ?? pollSeconds;
  useEffect(() => {
    if (!secret) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await tvApi.screen(secret);
        if (!cancelled) setScreen(next);
      } catch (err) {
        if (err instanceof TvAuthError) return lost();
        /* a dropped connection: keep showing what we have and try again */
      }
      if (!cancelled) timer = setTimeout(tick, Math.max(1, interval.current) * 1000);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [secret, lost]);

  useEffect(() => {
    if (device.phase === "pairing") router.replace("/");
  }, [device.phase, router]);

  if (!screen) return <main className="tv-safe flex min-h-screen items-center justify-center text-[1.6rem] text-ink-500">Connecting to your class…</main>;

  if (!screen.session) {
    return (
      <main className="tv-safe flex min-h-screen flex-col items-center justify-center gap-[1.6rem] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/peebee-logo-light.svg?v=logo-6" alt="" width={96} height={96} className="h-[6rem] w-[6rem]" />
        <h1 className="text-[3.6rem] font-black text-ink">Waiting for your tutor</h1>
        <p className="max-w-[44rem] text-[1.5rem] leading-snug text-ink-500">
          In Peebee Learn, start a live class and choose <strong className="text-ink">{screen.device.name}</strong> as the screen. This page will switch over by itself.
        </p>
        <p className="text-[1.1rem] text-ink-500">Press Back to return to the home screen.</p>
      </main>
    );
  }

  const session = screen.session;
  return (
    <main className="tv-safe flex min-h-screen flex-col gap-[1.4rem]">
      <header className="flex items-center justify-between">
        <p className="text-[1.3rem] font-bold text-ink-500">{session.title}</p>
        <p className="text-[1.1rem] text-ink-500">Peebee Learn</p>
      </header>
      <div className="flex min-h-0 flex-1 gap-[2.4rem]">
        <section key={screen.cue?.id ?? "idle"} className="tv-fade-in min-h-0 min-w-0 flex-1" aria-live="polite">
          {screen.cue ? (
            <StageCue cue={screen.cue} state={screen} now={now} soundOn={soundOn} />
          ) : (
            <div className="flex h-full flex-col justify-center gap-[1rem]">
              <p className="text-[1.1rem] font-bold uppercase tracking-[0.2em] text-gold">Class in session</p>
              <h1 className="text-[4.4rem] font-black leading-[1.08] text-ink">{session.title}</h1>
              <p className="text-[1.6rem] text-ink-500">Your tutor will be with you in a moment. Join from your phone with the code on the right.</p>
            </div>
          )}
        </section>
        <JoinCard code={session.code} url={session.joinUrl} participants={session.participants} present={session.present} hands={session.hands} />
      </div>
    </main>
  );
}
