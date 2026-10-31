"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DoorsProvider, HireProvider, doorFromSlug, doorPath, useRemoteDoors, type DoorId } from "../lib/doors";
import { ShellContext } from "./ShellContext";
import { TopBar } from "./TopBar";
import { FeatureSheet } from "./FeatureSheet";
import { MenuDrawer } from "./MenuDrawer";
import { DoorDrawer } from "./DoorDrawer";
import { TabBar } from "./Nav";
import { HomeScreen } from "./HomeScreen";
import { SiteFoot } from "./SiteFoot";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { DataRefresh } from "./DataRefresh";
import { StorefrontHostGateway } from "./StorefrontHostGateway";
import { PartnerShell } from "./PartnerShell";
import { SupportChat } from "./SupportChat";
import { ModuleNoticePage } from "./ModuleNotice";
import { DOOR_MODULE } from "../lib/module-map";
import { useWebModules } from "../lib/web-modules";

/** Carried over untouched from the previous site: merchant sign-up, shared purchase links, service pages and storefronts. */
const LEGACY = /^\/(portal|d|services|site)(\/|$)/;

/** /buy is the Buy drawer. /buy/stores is a page of its own, so only a one-segment path counts. */
function doorFromPath(path: string | null): DoorId | null {
  const parts = (path ?? "/").split("/").filter(Boolean);
  return parts.length === 1 ? doorFromSlug(parts[0]) : null;
}

/** The door a page belongs to, so its tab lights up (Spotlight and Pharmacy are Buy, Parcels is Ride): the app's own grouping. */
function contextDoorFromPath(path: string | null): DoorId | null {
  const first = (path ?? "/").split("/").filter(Boolean)[0];
  return first ? doorFromSlug(first) : null;
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { doors: configuredDoors, hire: hireConfigured } = useRemoteDoors();
  const modules = useWebModules();
  // Admin → Services also controls the site: a door whose module is off disappears from every menu and tab, and Hire
  // takes turns with Work only while Peebee Hire is on. If every door were off, keep the list so nothing breaks.
  const doors = useMemo(() => {
    const on = configuredDoors.filter((d) => modules.on(DOOR_MODULE[d.id]));
    return on.length ? on : configuredDoors;
  }, [configuredDoors, modules]);
  const hire = hireConfigured && modules.on("hive.hire");
  const requestedDoor = doorFromPath(pathname);
  // A link straight to a door that is switched off shows Admin's notice instead of the door.
  const blockedDoor = requestedDoor && !modules.on(DOOR_MODULE[requestedDoor]) ? requestedDoor : null;
  const activeDoor = blockedDoor ? null : requestedDoor;
  const contextDoor = activeDoor ?? contextDoorFromPath(pathname);
  const home = pathname === "/" || activeDoor !== null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [featureId, setFeatureId] = useState<string | null>(null);
  const openFeature = useCallback((id: string) => setFeatureId(id), []);
  const closeFeature = useCallback(() => setFeatureId(null), []);
  // Desktop (>=1100px) shows a door as a full page, never as a drawer.
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const isDesk = () => window.matchMedia("(min-width: 1100px)").matches;
  const scroller = useRef<HTMLElement | null>(null);
  const [barShown, setBarShown] = useState(true);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    let last = el.scrollTop, raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const y = el.scrollTop, max = el.scrollHeight - el.clientHeight;
      if (y <= 8 || y >= max - 8) { setBarShown(true); last = y; return; }
      const d = y - last; if (Math.abs(d) < 10) return;
      setBarShown(d < 0); last = y; }); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  const pushed = useRef(false);

  const [focus, setFocus] = useState<{ id: DoorId; section: string; n: number } | null>(null);
  const focusN = useRef(0);

  const openDoor = useCallback((id: DoorId, section?: string) => {
    setMenuOpen(false);
    const url = `${doorPath(id)}${section ? `#${section}` : ""}`;
    const cur = doorFromPath(window.location.pathname);
    if (section) setFocus({ id, section, n: ++focusN.current });
    else setFocus(null);
    if (isDesk()) {
      if (cur === id) { if (section) window.history.replaceState(null, "", url); return; }
      pushed.current = false;
      router.push(url);
      scroller.current?.scrollTo({ top: 0 });
      return;
    }
    if (cur === id) {
      if (section) window.history.replaceState(null, "", url);
      return;
    }
    if (cur) window.history.replaceState(null, "", url);
    else if (window.location.pathname === "/") {
      window.history.pushState(null, "", url);
      pushed.current = true;
    } else {
      // From a page of its own, the door opens over the home screen, and Back returns to the page.
      pushed.current = true;
      router.push(url);
    }
  }, [router]);

  // Home: close whatever drawer is open and go to the home screen.
  const goHome = useCallback(() => {
    setMenuOpen(false);
    setFocus(null);
    if (window.location.pathname === "/") scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
    else {
      pushed.current = false;
      router.push("/");
    }
  }, [router]);

  // A link such as /buy#spotlight opens that drawer already focused on the section.
  useEffect(() => {
    const id = doorFromPath(window.location.pathname);
    const section = window.location.hash.slice(1);
    if (id && section) setFocus({ id, section, n: ++focusN.current });
  }, []);

  const closeDoor = useCallback(() => {
    if (!doorFromPath(window.location.pathname)) return;
    setFocus(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", "/");
  }, []);

  // Escape closes whichever drawer is open (door first).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (doorFromPath(window.location.pathname) && !isDesk()) closeDoor();
      else if (menuOpen) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeDoor]);

  // A new page closes the menu and starts at the top.
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      const wasHome = prevPath.current === "/" || doorFromPath(prevPath.current);
      const isHome = pathname === "/" || doorFromPath(pathname);
      if (wasHome !== isHome || isDesk()) scroller.current?.scrollTo({ top: 0 });
      prevPath.current = pathname;
      setMenuOpen(false);
      if (!doorFromPath(pathname)) pushed.current = false;
    }
  }, [pathname]);

  const doorOpen = activeDoor !== null && !desk;
  if (/^\/partners(\/|$)/.test(pathname ?? "")) {
    return (
      <>
        <PartnerShell>{children}</PartnerShell>
        <SupportChat />
        <ServiceWorkerRegister />
      </>
    );
  }
  if (LEGACY.test(pathname ?? "")) {
    return (
      <>
        <ServiceWorkerRegister />
        <DataRefresh>{children}</DataRefresh>
      </>
    );
  }
  const shell = (
    <DoorsProvider value={doors}>
     <HireProvider value={hire}>
      <ShellContext.Provider value={{ scroller, activeDoor, contextDoor, goHome, openDoor, focus, closeDoor, openFeature, menuOpen, setMenuOpen }}>
        <div className="root" data-menu={menuOpen} data-door={doorOpen} data-home={home} data-bar={barShown}>
          <MenuDrawer />
          <div className="page" inert={menuOpen || doorOpen}>
            <a href="#main" className="skip">Skip to content</a>
            <TopBar />
            <div className="body">
              <main id="main" ref={scroller} className="scroller" tabIndex={-1}>
                {blockedDoor ? <ModuleNoticePage name={configuredDoors.find((d) => d.id === blockedDoor)?.label ?? blockedDoor} notice={modules.notice(DOOR_MODULE[blockedDoor])} /> : home ? <HomeScreen /> : children}
                <SiteFoot />
              </main>
            </div>
            <TabBar />
          </div>
          <button type="button" className="slice slice-menu" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
          <div className="scrim" aria-hidden />
          <button type="button" className="slice slice-door" aria-label="Close" tabIndex={doorOpen ? 0 : -1} onClick={closeDoor} />
          <DoorDrawer />
          <FeatureSheet id={featureId} onClose={closeFeature} />
          <SupportChat hidden={menuOpen || doorOpen || featureId !== null} />
        </div>
        <ServiceWorkerRegister />
      </ShellContext.Provider>
     </HireProvider>
    </DoorsProvider>
  );
  // On a merchant's own host (store.peebee.online or a custom domain) the home address shows their store, as before.
  return home ? <StorefrontHostGateway>{shell}</StorefrontHostGateway> : shell;
}
