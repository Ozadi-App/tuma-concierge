"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BadgeCheck, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { APP_FEATURES } from "../lib/features";
import { useShell } from "./ShellContext";
import { PartnerLink } from "./PartnerLink";
import { HomeAbout } from "./HomeAbout";

const SHOT: Record<string, string> = { ride: "/app-shots/ride.webp", buy: "/app-shots/buy.webp", eat: "/app-shots/eat.webp", learn: "/app-shots/learn.webp", hive: "/app-shots/work.webp" };


/** Adds .mh-in to [data-reveal] children once they scroll into view. */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("mh-in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("mh-in"); io.unobserve(e.target); } }), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Extra mobile/tablet home sections, below the hero tiles. */
export function MobileHomeMore() {
  const { openFeature } = useShell();
  const ref = useReveal();
  const track = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  function onScroll() {
    const t = track.current; if (!t) return;
    const w = (t.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
    setAt(Math.round(t.scrollLeft / (w + 14)));
  }
  function go(i: number) {
    const t = track.current; const el = t?.children[i] as HTMLElement | undefined;
    if (t && el) t.scrollTo({ left: el.offsetLeft - t.offsetLeft - 16, behavior: "smooth" });
  }
  return (
    <div className="mh" ref={ref}>
      <section className="mh-doors" aria-labelledby="mh-doors-h" data-reveal>
        <div className="mh-head">
          <p className="mh-kick">Built in</p>
          <h2 id="mh-doors-h">Everything that comes with it.</h2>
          <p className="mh-sub">The tools that work behind every order you place.</p>
        </div>
        <ul className="mh-track" ref={track} onScroll={onScroll}>
          {APP_FEATURES.map((f, i) => (
            <li key={f.id} className="mh-card mh-feat" data-n={i % 3}>
              <span className="mh-ficon"><f.icon size={30} strokeWidth={1.8} aria-hidden /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <button type="button" className="mh-more" onClick={() => openFeature(f.id)}>Learn more <ArrowRight size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
        <div className="mh-dots" role="tablist" aria-label="Features">
          {APP_FEATURES.map((f, i) => <button key={f.id} type="button" role="tab" aria-selected={i === at} aria-label={f.title} onClick={() => go(i)} />)}
        </div>
      </section>

      <section className="mh-how" aria-labelledby="mh-how-h" data-reveal>
        <p className="mh-kick">How it works</p>
        <h2 id="mh-how-h">Up and running in three steps.</h2>
        <ol className="mh-steps">
          <li><b>Download Peebee</b><span>Get the app on your phone and create your account.</span></li>
          <li><b>Set up your wallet and PIN</b><span>Top up once. Your PIN releases payments, so only you can let money go.</span></li>
          <li><b>Open any door</b><span>Ride, buy, eat, learn or book work, all paid from the same wallet.</span></li>
        </ol>
        <Link href="/how-it-works" className="mh-link">See how it works <ArrowRight size={15} aria-hidden /></Link>
      </section>

      <section className="mh-trust" aria-labelledby="mh-trust-h" data-reveal>
        <h2 id="mh-trust-h">Built so you can relax.</h2>
        <div className="mh-trust-grid">
          <div><ShieldCheck size={22} aria-hidden /><b>Escrow on every job</b><span>Your money waits until the job is done.</span></div>
          <div><KeyRound size={22} aria-hidden /><b>PIN-protected wallet</b><span>Nothing leaves without your PIN.</span></div>
          <div><BadgeCheck size={22} aria-hidden /><b>Verified partners</b><span>Riders, kitchens and pros are checked before they join.</span></div>
          <div><LifeBuoy size={22} aria-hidden /><b>Live support</b><span>Chat with the Peebee team from the app.</span></div>
        </div>
      </section>

      <div data-reveal><HomeAbout /></div>

      <section className="mh-grow" aria-labelledby="mh-grow-h" data-reveal>
        <p className="mh-kick">Grow with Peebee</p>
        <h2 id="mh-grow-h">Ride, cook, sell or teach? Earn with us.</h2>
        <p>Join as a partner and reach customers who already pay from a Peebee wallet.</p>
        <PartnerLink href="/partners" className="mh-grow-btn">Become a partner <ArrowUpRight size={16} aria-hidden /></PartnerLink>
        <Link href="/careers" className="mh-grow-slim">Selling is your thing? Work with us as a sales agent <ArrowRight size={14} aria-hidden /></Link>
      </section>

    </div>
  );
}
