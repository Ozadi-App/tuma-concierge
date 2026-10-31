"use client";

import Link from "next/link";
import { PartnerLink } from "./PartnerLink";
import { ArrowUpRight, Handshake } from "lucide-react";
import { useDoors } from "../lib/doors";
import { APP_URL, DOOR_CONTENT } from "../lib/content";
import { useAppFeatures } from "./useDoorContent";
import { FeatureTiles } from "./FeatureSheet";
import { useShell } from "./ShellContext";
import { useRef } from "react";
import { useFocusTrap } from "../lib/focus";
import { Logo } from "./Logo";

export function MenuDrawer() {
  const { menuOpen, setMenuOpen, openDoor, openFeature } = useShell();
  const doors = useDoors();
  const appFeatures = useAppFeatures();
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref, menuOpen);
  return (
    <aside id="menu" ref={ref} className="menu" aria-label="Menu" aria-hidden={!menuOpen} inert={!menuOpen} role="dialog" aria-modal={menuOpen}>
      <div className="menu-in">
        <div className="menu-head">
          <Logo className="brand-mark" />
          <span className="brand-word">Peebee</span>
        </div>
        <p className="menu-kicker">Modules</p>
        <ul className="menu-list">
          {doors.map((d) => {
            const c = DOOR_CONTENT[d.id];
            return (
              <li key={d.id}>
                <button type="button" onClick={() => openDoor(d.id)}>
                  <c.icon size={20} aria-hidden />
                  <span>
                    <b>{d.label}</b>
                    <small>{c.tile}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <FeatureTiles items={appFeatures} onOpen={(fid) => { setMenuOpen(false); openFeature(fid); }} />
        <nav className="menu-co" aria-label="Company">
          <Link href="/about" onClick={() => setMenuOpen(false)}>About us</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact us</Link>
          <Link href="/careers" onClick={() => setMenuOpen(false)}>Work with us</Link>
        </nav>
        <div className="menu-foot">
          <PartnerLink href="/partners" className="menu-partner" onClick={() => setMenuOpen(false)}>
            <Handshake size={18} aria-hidden /> Partner with Peebee
          </PartnerLink>
          <a href={APP_URL} className="btn btn-gold">
            Download the app <ArrowUpRight size={16} aria-hidden />
          </a>
        </div>
      </div>
    </aside>
  );
}
