"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { useDoors, type DoorId } from "../lib/doors";
import { APP_URL, DOOR_CONTENT } from "../lib/content";
import { subPath } from "../lib/pages";
import { PHOTOS } from "../lib/photos";
import { useShell } from "./ShellContext";
import { FeatureTiles } from "./FeatureSheet";
import { useDoorContent } from "./useDoorContent";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Desktop (>=1100px): a door is a full page in the landing's style, not a drawer. */
export function DesktopDoorPage({ id }: { id: DoorId }) {
  const doors = useDoors();
  const { scroller, openDoor, focus, openFeature } = useShell();
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const c = useDoorContent(id);
  const door = doors.find((d) => d.id === id);
  const label = door?.label ?? id;
  const idx = doors.findIndex((d) => d.id === id);
  const next = doors.length && idx >= 0 ? doors[(idx + 1) % doors.length] : null;
  const prev = doors.length && idx >= 0 ? doors[(idx - 1 + doors.length) % doors.length] : null;

  useEffect(() => { setOpenKey(null); }, [id]);
  useEffect(() => {
    const sec = focus?.id === id ? focus.section : (typeof window !== "undefined" ? window.location.hash.slice(1) : "");
    const ft = c.features.find((i) => i.key === sec);
    if (ft) { openFeature(`${ft.door}/${ft.key}`); return; }
    const it = c.items.find((i) => i.key === sec);
    if (it) setOpenKey(it.key);
  }, [focus, id, c.items, c.features, openFeature]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>("[data-reveal]");
    if (reduced()) { items.forEach((x) => x.setAttribute("data-in", "")); return; }
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }, { root: scroller.current, rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    items.forEach((x) => { x.removeAttribute("data-in"); io.observe(x); });
    const amb = new IntersectionObserver((es) => { for (const e of es) e.target.toggleAttribute("data-play", e.isIntersecting); }, { root: scroller.current });
    el.querySelectorAll("[data-ambient]").forEach((x) => amb.observe(x));
    return () => { io.disconnect(); amb.disconnect(); };
  }, [id, scroller]);

  return (
    <div className="dl dd" ref={root} key={id}>
      <section className="dd-hero">
        <div className="dl-aurora" data-ambient aria-hidden>
          <i className="o1" /><i className="o2" /><i className="o3" /><i className="o4" />
          <span className="dl-grain" />
        </div>
        <div className="dl-wrap dd-hero-grid">
          <div>
            <p className="dl-kicker" data-reveal><c.icon size={16} aria-hidden /> {label}</p>
            <h1 className="dl-h1 dd-h1" data-reveal>{c.headline}</h1>
            <p className="dl-sub" data-reveal>{c.lead}</p>
            <div className="dl-ctas" data-reveal>
              <a href={APP_URL} className="dl-btn dl-btn-gold">Download the app <ArrowUpRight size={18} aria-hidden /></a>
              {next && next.id !== id && <button type="button" className="dl-btn dl-btn-ghost" onClick={() => openDoor(next.id)}>Next: {next.label} <ArrowRight size={16} aria-hidden /></button>}
            </div>
          </div>
          <div className="dd-photo" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTOS[id].card} alt={PHOTOS[id].alt} />
          </div>
        </div>
      </section>

      <section className="dl-wrap dd-main">
        <div className="dd-about" data-reveal>
          <p className="dl-kicker">About {label}</p>
          <p>{c.about}</p>
        </div>
        <div className="dd-svc">
        <p className="svc-kicker">Services</p>
        <ul className="acc dd-acc acc-svc">
          {c.items.map((it, n) => {
            const style = { transitionDelay: `${Math.min(n, 8) * 40}ms` };
            const on = openKey === it.key;
            return (
              <li key={it.key} className="acc-item" data-open={on} data-reveal style={style}>
                <h3><button type="button" id={`${uid}-h-${it.key}`} className="acc-head" aria-expanded={on} aria-controls={`${uid}-p-${it.key}`} onClick={() => setOpenKey(on ? null : it.key)}>
                  <span className="feat-ic"><it.icon size={20} aria-hidden /></span>
                  <span className="acc-title">{it.title}{it.tag && <em>{it.tag}</em>}</span>
                  <ChevronDown size={18} aria-hidden className="acc-chev" />
                </button></h3>
                <div id={`${uid}-p-${it.key}`} role="region" aria-labelledby={`${uid}-h-${it.key}`} className="acc-panel" inert={!on}>
                  <div className="acc-clip">
                    <p>{it.text}</p>
                    <div className="acc-actions"><Link href={subPath(id, it.key)} className="btn btn-gold">Learn more <ArrowRight size={16} aria-hidden /></Link></div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <FeatureTiles items={c.features.map((f) => ({ id: `${f.door}/${f.key}`, icon: f.icon, title: f.chip && f.title.length > 22 ? f.chip : f.title }))} onOpen={openFeature} />
        </div>
      </section>

      <nav className="dl-wrap dd-nav" aria-label="Other doors" data-reveal>
        {prev && prev.id !== id && <button type="button" onClick={() => openDoor(prev.id)}><span>Previous</span>{prev.label}</button>}
        <a href={APP_URL} className="dl-btn dl-btn-gold">Download the app <ArrowUpRight size={18} aria-hidden /></a>
        {next && next.id !== id && <button type="button" className="dd-next" onClick={() => openDoor(next.id)}><span>Next door</span>{next.label} <ArrowRight size={18} aria-hidden /></button>}
      </nav>
    </div>
  );
}
