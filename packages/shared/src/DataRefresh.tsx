"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Wraps each app's page content and does two jobs.
 *
 * 1. Wireframe loading. While a screen is still loading, a grey wireframe of
 *    that screen is shown in its place: the real layout, cards and sizes with
 *    every piece of content replaced by a grey block. The wireframe is made
 *    from the screen itself — once a screen has finished loading, its
 *    structure (never its text, links, images or values) is remembered on the
 *    device, so the next visit shows exactly that screen's shape. A screen
 *    never seen before gets a generic wireframe.
 * 2. Fresh data. Apps show saved pages and data first (see each app's
 *    public/sw.js); when the service worker reports that the server's copy of
 *    something differs, the current screen reloads — but never while the
 *    person is typing or has a dialog open.
 */

const STORE_PREFIX = "pb-skel:v1:";
const MAX_SNAPSHOT_CHARS = 60_000;
const MAX_NODES = 1500;
const READY_AFTER_IDLE_MS = 300;
const GIVE_UP_AFTER_MS = 5000;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const CSS = `
.pb-skel{pointer-events:none;user-select:none;-webkit-user-select:none;animation:pb-skel-pulse 1.4s ease-in-out infinite}
.pb-skel,.pb-skel *{color:transparent!important;text-shadow:none!important}
.pb-skel *{animation:none!important;transition:none!important}
.pb-skel .pb-bone{background:rgb(128 128 128/.18)!important;box-shadow:none!important;border-color:transparent!important;background-image:none!important}
.pb-skel .pb-bone:not([class*="rounded"]){border-radius:8px}
.pb-skel .pb-bone>*{visibility:hidden}
.pb-skel .pb-media{background:rgb(128 128 128/.18)!important;border-color:transparent!important;box-shadow:none!important;background-image:none!important;display:block;flex-shrink:0}
.pb-skel .pb-media:not([class*="rounded"]){border-radius:12px}
.pb-gen{padding:16px;display:grid;gap:12px}
.pb-gen .pb-bar{height:22px;width:55%;border-radius:8px;background:rgb(128 128 128/.18)}
.pb-gen .pb-card{height:92px;border-radius:20px;background:rgb(128 128 128/.14)}
@keyframes pb-skel-pulse{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.pb-skel{animation:none}}
`;

const GENERIC_SNAPSHOT =
  '<div class="pb-gen"><div class="pb-bar"></div><div class="pb-card"></div><div class="pb-card"></div><div class="pb-card"></div><div class="pb-card"></div></div>';

// ---- Tracking in-flight requests (to know when a screen has finished loading) ----

let inflight = 0;
let fetchPatched = false;

function patchFetch() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = "";
    try {
      url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    } catch {}
    // Next.js background prefetches say nothing about whether this screen has loaded.
    if (url.includes("_rsc=") || url.includes("/_next/")) return original(input, init);
    inflight++;
    return original(input, init).finally(() => {
      inflight = Math.max(0, inflight - 1);
    });
  };
}

// ---- Knowing which screen we are on (without depending on the framework) ----

function usePathname(): string {
  const [path, setPath] = useState(() => (typeof location !== "undefined" ? location.pathname : ""));
  useEffect(() => {
    const update = () => setPath((p) => (p === location.pathname ? p : location.pathname));
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function (...args: Parameters<History["pushState"]>) {
      const result = push.apply(this, args);
      queueMicrotask(update);
      return result;
    };
    history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      const result = replace.apply(this, args);
      queueMicrotask(update);
      return result;
    };
    window.addEventListener("popstate", update);
    update();
    return () => {
      history.pushState = push;
      history.replaceState = replace;
      window.removeEventListener("popstate", update);
    };
  }, []);
  return path;
}

// ---- Remembering a screen's shape ----

const MEDIA_TAGS = new Set(["img", "svg", "video", "canvas", "picture", "iframe", "input", "textarea", "select", "audio", "object", "embed"]);
const SKIP_TAGS = new Set(["script", "style", "noscript", "template", "link", "meta", "head"]);

/** Same-length stand-in text, so lines wrap where the real ones do. Nothing readable is kept. */
function maskText(text: string): string {
  return text.replace(/[^\s]/g, "x");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeClass(el: Element): string {
  const raw = el.getAttribute("class") ?? "";
  return raw.replace(/["<>]/g, "");
}

function safeStyle(el: Element): string {
  const raw = el.getAttribute("style") ?? "";
  if (!raw || /url\(|expression\(/i.test(raw)) return "";
  return raw.replace(/["<>]/g, "");
}

/** Tags that keep their meaning for layout; everything else (links, buttons, custom) becomes a plain block. */
const KEEP_TAGS = new Set(["ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "label", "strong", "em", "b", "i", "section", "article", "header", "footer", "nav", "main", "aside"]);
const OUT_TAG = (tag: string) => (KEEP_TAGS.has(tag) ? tag : "div");

function snapshotOf(root: HTMLElement): string | null {
  const vh = window.innerHeight;
  let nodes = 0;
  let blocks = 0;

  function walk(el: Element, depth: number): string {
    if (nodes >= MAX_NODES || depth > 40) return "";
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return "";
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return "";
    // Floating bars and buttons belong to the app shell; a full-screen fixed layer (a sign-in scene) is the screen itself.
    if (style.position === "fixed" && (el.getBoundingClientRect().width < window.innerWidth * 0.9 || el.getBoundingClientRect().height < vh * 0.9)) return "";
    // Wrappers that take no space of their own (display: contents) are looked through.
    if (style.display === "contents") {
      let through = "";
      for (const child of Array.from(el.children)) through += walk(child, depth + 1);
      return through;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return "";
    if (rect.top > vh * 1.5) return "";
    nodes++;

    const cls = safeClass(el);
    const styleAttr = safeStyle(el);

    if (MEDIA_TAGS.has(tag)) {
      blocks++;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const size = `width:${w}px;max-width:100%;aspect-ratio:${w}/${h};`;
      return `<div class="${cls} pb-media" style="${size}"></div>`;
    }

    let hasText = false;
    let inner = "";
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text.trim()) hasText = true;
        inner += escapeHtml(maskText(text));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        inner += walk(child as Element, depth + 1);
      }
    }
    if (hasText) blocks++;
    const bone = hasText ? " pb-bone" : "";
    const out = OUT_TAG(tag);
    return `<${out} class="${cls}${bone}"${styleAttr ? ` style="${styleAttr}"` : ""}>${inner}</${out}>`;
  }

  let html = "";
  for (const child of Array.from(root.children)) html += walk(child, 0);
  // A screen with almost nothing in it (a full-screen map, a redirect) is better served by the generic wireframe.
  if (blocks < 3 || html.length < 60 || html.length > MAX_SNAPSHOT_CHARS) return null;
  return html;
}

function readSnapshot(path: string): string {
  try {
    return window.localStorage.getItem(STORE_PREFIX + path) || GENERIC_SNAPSHOT;
  } catch {
    return GENERIC_SNAPSHOT;
  }
}

function writeSnapshot(path: string, html: string) {
  try {
    window.localStorage.setItem(STORE_PREFIX + path, html);
  } catch {
    // Storage full or blocked: the generic wireframe is used instead.
  }
}

// ---- Keeping the screen fresh ----

/** True while a re-render of the screen could disturb the person using it. */
function userIsBusy(): boolean {
  if (document.visibilityState !== "visible") return true;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return !!document.querySelector('[role="dialog"], [aria-modal="true"]');
}

export function DataRefresh({ children }: { children: unknown }) {
  const [version, setVersion] = useState(0);
  const path = usePathname();
  const [shownPath, setShownPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(GENERIC_SNAPSHOT);
  const contentRef = useRef<HTMLDivElement>(null);

  // A screen opens: show its wireframe until it has finished loading.
  useIsoLayoutEffect(() => {
    if (!path || path === shownPath) return;
    patchFetch();
    setShownPath(path);
    setSnapshot(readSnapshot(path));
    setLoading(true);
  }, [path, shownPath]);

  // Wait for the screen to finish loading, then show it and remember its shape.
  useEffect(() => {
    if (!loading || !shownPath) return;
    const startedAt = Date.now();
    let idleSince: number | null = null;
    let done = false;
    const timer = setInterval(() => {
      const now = Date.now();
      const busy = inflight > 0 || !!contentRef.current?.querySelector('[aria-busy="true"], .animate-spin');
      if (busy) idleSince = null;
      else if (idleSince === null) idleSince = now;
      const idle = idleSince !== null && now - idleSince >= READY_AFTER_IDLE_MS;
      if (!done && (idle || now - startedAt >= GIVE_UP_AFTER_MS)) {
        done = true;
        clearInterval(timer);
        setLoading(false);
        const pathAtFinish = shownPath;
        // A timer rather than an animation frame: frames do not fire in a background tab.
        setTimeout(() => {
          if (!contentRef.current || location.pathname !== pathAtFinish) return;
          const html = snapshotOf(contentRef.current);
          if (html) writeSnapshot(pathAtFinish, html);
        }, 150);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [loading, shownPath]);

  // The server's copy of some data changed: reload this screen when it is safe to.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function attempt() {
      if (userIsBusy()) {
        timer = setTimeout(attempt, 3000);
        return;
      }
      setVersion((n) => n + 1);
    }
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "peebee-data-updated") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, 1500);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ display: "contents" }}>
      <style>{CSS}</style>
      {loading ? <div className="pb-skel" aria-hidden="true" dangerouslySetInnerHTML={{ __html: snapshot }} /> : null}
      <div
        ref={contentRef}
        style={
          loading
            ? { position: "fixed", top: 0, left: 0, width: "100%", visibility: "hidden", pointerEvents: "none" }
            : { display: "contents" }
        }
      >
        <div key={version} style={{ display: "contents" }}>
          {children as never}
        </div>
      </div>
    </div>
  );
}
