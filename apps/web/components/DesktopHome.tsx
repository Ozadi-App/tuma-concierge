"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useDoors, type DoorId } from "../lib/doors";
import { subPath } from "../lib/pages";
import { ALSO_IN_ACCOUNT, APP_URL, DOOR_CONTENT, WALLET_NOTE } from "../lib/content";
import { useShell } from "./ShellContext";
import { HeroCycle } from "./HeroCycle";
import { OrderPath } from "./OrderPath";
import { PhoneScreens } from "./PhonePreview";
import { useWebModules } from "../lib/web-modules";
import { moduleOfHref, moduleOfSub } from "../lib/module-map";
import { ModuleShow } from "./ModuleNotice";

export function DesktopHome() {
  const doors = useDoors();
  const modules = useWebModules();
  const { scroller, openDoor, openFeature } = useShell();
  const [active, setActive] = useState<DoorId>(doors[0]?.id ?? "ride");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.getAttribute("data-door") as DoorId);
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [scroller, doors]);

  const screenIndex = Math.max(0, doors.findIndex((d) => d.id === active));

  return (
    <div className="desk">
      <HeroCycle />

      <section className="band">
        <div className="wrap band-grid">
          <div>
            <p className="kicker">How an order moves</p>
            <h2 id="path-desk" className="display">Six steps, the same every time.</h2>
          </div>
          <OrderPath id="path-desk" />
        </div>
      </section>

      <section className="chapters wrap" aria-label="The five doors">
        <div className="chapters-text">
          {doors.map((d, i) => {
            const c = DOOR_CONTENT[d.id];
            return (
              <article key={d.id} className="chapter" data-door={d.id} ref={(el) => { refs.current[d.id] = el; }} aria-labelledby={`ch-${d.id}`}>
                <p className="kicker"><span className="kicker-n">0{i + 1}</span> <c.icon size={16} aria-hidden /> {d.label}</p>
                <h2 id={`ch-${d.id}`} className="display">{c.headline}</h2>
                <p className="lead">{c.lead}</p>
                <ul className="chap-list">
                  {c.items.filter((it) => modules.on(moduleOfSub(it.door, it.key))).map((it) => (
                    <li key={it.key}>
                      {it.direct ? (
                        <Link href={subPath(d.id, it.key)}>
                          <span className="feat-ic"><it.icon size={18} aria-hidden /></span>
                          <span>
                            <b>{it.title}{it.tag && <em>{it.tag}</em>}</b>
                            <small>{it.text}</small>
                          </span>
                          <ArrowUpRight size={16} className="chap-arrow" aria-hidden />
                        </Link>
                      ) : (
                        <button type="button" onClick={() => openDoor(d.id, it.key)}>
                          <span className="feat-ic"><it.icon size={18} aria-hidden /></span>
                          <span>
                            <b>{it.title}{it.tag && <em>{it.tag}</em>}</b>
                            <small>{it.text}</small>
                          </span>
                          <ArrowRight size={16} className="chap-arrow" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {c.note && (
                  <ModuleShow module={c.note.href ? moduleOfHref(c.note.href) : null}><p className="chap-note"><c.note.icon size={18} aria-hidden /><span><b>{c.note.title}</b> {c.note.text}</span></p></ModuleShow>
                )}
                <button type="button" className="btn btn-ink" onClick={() => openDoor(d.id)}>
                  Open {d.label} <ArrowRight size={16} aria-hidden />
                </button>
              </article>
            );
          })}
        </div>
        <div className="chapters-phone" aria-hidden>
          <div className="phone-sticky">
            <div className="phone" style={{ "--screen": screenIndex } as React.CSSProperties}>
              <div className="phone-notch" />
              <div className="phone-screens" data-active={screenIndex}>
                <PhoneScreens doors={doors} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band band-alt">
        <div className="wrap">
          <p className="kicker">Also in your account</p>
          <h2 className="display">Money, medicine, and parcels, under the same login.</h2>
          <ul className="also">
            {ALSO_IN_ACCOUNT.map((a) => (
              <ModuleShow key={a.title} module={moduleOfHref(a.href)}><li>
                {a.feature ? (
                  <button type="button" onClick={() => openFeature(a.feature!)} aria-haspopup="dialog">
                    <span className="feat-ic"><a.icon size={20} aria-hidden /></span>
                    <b>{a.title}</b>
                    <small>{a.text}</small>
                  </button>
                ) : (
                  <Link href={a.href}>
                    <span className="feat-ic"><a.icon size={20} aria-hidden /></span>
                    <b>{a.title}</b>
                    <small>{a.text}</small>
                  </Link>
                )}
              </li></ModuleShow>
            ))}
          </ul>
          <p className="wallet-line">{WALLET_NOTE}</p>
        </div>
      </section>

      <section className="closing wrap">
        <h2 className="display">Phone in hand? Start with a door.</h2>
        <a href={APP_URL} className="btn btn-gold btn-lg">Download the app <ArrowUpRight size={18} aria-hidden /></a>
      </section>
    </div>
  );
}
