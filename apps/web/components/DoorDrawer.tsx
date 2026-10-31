"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, X } from "lucide-react";
import { useDoors, type DoorId } from "../lib/doors";
import { APP_URL, DOOR_CONTENT } from "../lib/content";
import { subPath } from "../lib/pages";
import { PHOTOS } from "../lib/photos";
import { useShell } from "./ShellContext";
import { FeatureTiles } from "./FeatureSheet";
import { useFocusTrap } from "../lib/focus";
import { useDoorContent } from "./useDoorContent";
import { ModuleShow } from "./ModuleNotice";
import { moduleOfHref } from "../lib/module-map";

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The right-hand drawer for one of the five doors: a photo, a few sentences about the door, one pill per
 * sub-feature, and an exclusive accordion under the pills. A pill and its accordion header are the same switch;
 * tapping the open one closes it. Spotlight, Pharmacy and Parcels are pages of their own, so their pills are links.
 */
export function DoorDrawer() {
  const { activeDoor, closeDoor } = useShell();
  const doors = useDoors();
  const [shown, setShown] = useState<DoorId | null>(activeDoor);
  const ref = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // keep showing the last door while the drawer slides out
  if (activeDoor && activeDoor !== shown) setShown(activeDoor);

  useFocusTrap(ref, activeDoor !== null, ".drawer-close");
  const id = shown;
  const open = activeDoor !== null;
  const door = id ? doors.find((d) => d.id === id) : undefined;
  const label = door?.label ?? id ?? "";
  const c = id ? DOOR_CONTENT[id] : null;

  return (
    <aside ref={ref} className="drawer" role="dialog" aria-modal={open} aria-hidden={!open} inert={!open} aria-label={label}>
      <button type="button" className="drawer-close" onClick={closeDoor} aria-label={`Close ${label}`}>
        <X size={20} aria-hidden />
      </button>
      {c && id && door && (
        <div className="drawer-grid" ref={body} key={id}>
          <div className="drawer-photo rv-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTOS[id].card} alt={PHOTOS[id].alt} />
            <div className="drawer-photo-shade" />
            <div className="drawer-photo-label">
              <c.icon size={22} aria-hidden />
              <span>{label}</span>
            </div>
          </div>
          <DoorBody id={id} label={label} scroller={body} />
        </div>
      )}
    </aside>
  );
}

function DoorBody({ id, label, scroller }: { id: DoorId; label: string; scroller: React.RefObject<HTMLDivElement | null> }) {
  const { activeDoor, openDoor, focus, openFeature } = useShell();
  const doors = useDoors();
  const c = useDoorContent(id);
  const uid = useId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const idx = doors.findIndex((d) => d.id === id);
  const next = doors.length && idx >= 0 ? doors[(idx + 1) % doors.length] : null;

  // Bring a header into view once its panel has finished opening (so the measurement is the final one).
  const reveal = useCallback((key: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const box = scroller.current;
      const el = box?.querySelector<HTMLElement>(`[data-sub="${key}"]`);
      if (!box || !el) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 72;
      box.scrollTo({ top: Math.max(0, top), behavior: calm() ? "auto" : "smooth" });
    }, calm() ? 0 : 250);
  }, [scroller]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toggle = useCallback((key: string) => {
    setOpenKey((cur) => {
      if (cur === key) return null;
      reveal(key);
      return key;
    });
  }, [reveal]);

  // openDoor(id, "groceries") and /buy#groceries open that section. A page-link item is only marked.
  useEffect(() => {
    if (!focus || focus.id !== activeDoor || focus.id !== id) return;
    const feat = c.features.find((i) => i.key === focus.section);
    if (feat) { const t = window.setTimeout(() => openFeature(`${feat.door}/${feat.key}`), 380); return () => window.clearTimeout(t); }
    const sub = c.items.find((i) => i.key === focus.section);
    if (!sub) return;
    const t = window.setTimeout(() => { setOpenKey(sub.key); reveal(sub.key); }, 380);
    return () => window.clearTimeout(t);
  }, [focus, activeDoor, id, c.items, c.features, reveal, openFeature]);

    const pid = (k: string) => `${uid}-panel-${k}`;
  const hid = (k: string) => `${uid}-head-${k}`;

  return (
    <div className="drawer-body">
      <h2 className="rv" style={{ "--i": 0 } as React.CSSProperties}>{c.headline}</h2>
      <p className="about rv" style={{ "--i": 1 } as React.CSSProperties}>{c.about}</p>

      <p className="svc-kicker">Services</p>
      <ul className="acc acc-svc">
        {c.items.map((it) => {
          const on = openKey === it.key;
          return (
            <li key={it.key} className="acc-item" data-sub={it.key} data-open={on}>
              <h3>
                <button type="button" id={hid(it.key)} className="acc-head" aria-expanded={on} aria-controls={pid(it.key)} onClick={() => toggle(it.key)}>
                  <span className="feat-ic"><it.icon size={20} aria-hidden /></span>
                  <span className="acc-title">
                    {it.title}
                    {it.tag && <em>{it.tag}</em>}
                  </span>
                  <ChevronDown size={18} aria-hidden className="acc-chev" />
                </button>
              </h3>
              <div id={pid(it.key)} role="region" aria-labelledby={hid(it.key)} className="acc-panel" inert={!on}>
                <div className="acc-clip">
                  <p>{it.text}</p>
                  <div className="acc-actions">
                    <Link href={subPath(id, it.key)} className="btn btn-gold">
                      Learn more <ArrowRight size={16} aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <FeatureTiles items={c.features.map((f) => ({ id: `${f.door}/${f.key}`, icon: f.icon, title: f.chip && f.title.length > 22 ? f.chip : f.title }))} onOpen={openFeature} />

      {c.note && (
        <ModuleShow module={c.note.href ? moduleOfHref(c.note.href) : null}>
        <Link href={c.note.href ?? "/"} className="note note-link rv" style={{ "--i": 3 } as React.CSSProperties}>
          <c.note.icon size={20} aria-hidden />
          <span>
            <b>{c.note.title}</b>
            <small>{c.note.text}</small>
          </span>
          <ArrowRight size={18} aria-hidden className="note-go" />
        </Link>
        </ModuleShow>
      )}
      <div className="drawer-cta rv" style={{ "--i": 4 } as React.CSSProperties}>
        <a href={APP_URL} className="btn btn-gold">
          Open {label} in Peebee <ArrowUpRight size={16} aria-hidden />
        </a>
        {next && next.id !== id && (
          <button type="button" className="btn btn-quiet" onClick={() => openDoor(next.id)}>
            Next: {next.label} <ArrowRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
