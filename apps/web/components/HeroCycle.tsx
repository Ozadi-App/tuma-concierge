"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useDoors } from "../lib/doors";
import { DOOR_CONTENT } from "../lib/content";
import { PHOTOS } from "../lib/photos";
import { useShell } from "./ShellContext";

export function HeroCycle() {
  const doors = useDoors();
  const { openDoor } = useShell();
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [moved, setMoved] = useState(false);
  const [hidden, setHidden] = useState(false);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  function go(n: number) {
    const next = (n + doors.length) % doors.length;
    if (next === cur) return;
    setPrev(cur);
    setMoved(true);
    setCur(next);
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setPrev(null), 1400);
  }

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Peebee" data-paused={paused || hidden} data-moved={moved}>
      <div className="hero-slides">
        {doors.map((d, i) => {
          const p = PHOTOS[d.id];
          const c = DOOR_CONTENT[d.id];
          const role = i === cur ? "cur" : i === prev ? "prev" : "idle";
          return (
            <div
              key={d.id}
              className="slide"
              data-role={role}
              data-dark-side={p.darkSide}
              data-light-side={p.lightSide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${doors.length}: ${d.label}`}
              aria-hidden={i !== cur}
            >
              <div className="slide-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.hero} alt={i === cur ? p.alt : ""} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />
              </div>
              <div className="slide-scrim" />
              <div className="slide-edge" />
              <div className="hero-text">
                <p className="kicker"><c.icon size={16} aria-hidden /> {d.label}</p>
                {i === 0 ? <h1>{c.heroTitle}</h1> : <h2>{c.heroTitle}</h2>}
                <p className="hero-sub">{c.heroSub}</p>
                <div className="hero-btns">
                  <button type="button" className="btn btn-gold" tabIndex={i === cur ? 0 : -1} onClick={() => openDoor(d.id)}>
                    See {d.label} <ArrowRight size={16} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero-ctl">
        <ol className="hero-bars">
          {doors.map((d, i) => (
            <li key={d.id}>
              <button type="button" onClick={() => go(i)} aria-label={`Show ${d.label}`} aria-current={i === cur ? "true" : undefined}>
                <span className="bar-name">{d.label}</span>
                <span className="bar-track">
                  <span
                    key={i === cur ? `a${cur}` : `i${i}`}
                    className="bar-fill"
                    data-on={i === cur}
                    onAnimationEnd={() => i === cur && go(cur + 1)}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="icon-btn hero-pause" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Play slideshow" : "Pause slideshow"}>
          {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
        </button>
      </div>
    </section>
  );
}
