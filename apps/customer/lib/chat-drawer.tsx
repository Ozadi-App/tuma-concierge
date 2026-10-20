"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatInbox } from "../components/chat/ChatInbox";
import { useTranslate } from "./i18n";

/** Matches the CSS transition on .app-stage / .chat-drawer. */
const SLIDE_MS = 420;
const SWIPE_CLOSE_PX = 70;

type ChatDrawer = { open: boolean; openChat: () => void; closeChat: () => void; toggleChat: () => void };
const Ctx = createContext<ChatDrawer>({ open: false, openChat: () => {}, closeChat: () => {}, toggleChat: () => {} });
export const useChatDrawer = () => useContext(Ctx);

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Wraps the whole app screen (banners, header, page, bottom menu) as one "stage".
 * Opening chat slides the stage left, leaving a slice of it at the left edge, and the chat screen
 * underneath eases up from slightly zoomed out. While the stage is moved it is pinned to the viewport
 * at the same scroll offset, so fixed and sticky parts of the app stay where they were.
 */
export function ChatDrawerShell({ children }: { children: ReactNode }) {
  const tr = useTranslate();
  const pathname = usePathname();
  const [lock, setLock] = useState(false);
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState(0);
  const [lockY, setLockY] = useState(0);
  const lockRef = useRef(false);
  const restoreY = useRef<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);
  lockRef.current = lock;

  const openChat = useCallback(() => {
    if (lockRef.current) return;
    window.clearTimeout(timer.current);
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLockY(window.scrollY);
    setMounted(true);
    setSession((n) => n + 1);
    setLock(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);

  const closeChat = useCallback(() => {
    if (!lockRef.current) return;
    setShown(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      restoreY.current = lockY;
      setLock(false);
      returnFocus.current?.focus?.();
    }, prefersReducedMotion() ? 0 : SLIDE_MS);
  }, [lockY]);

  const toggleChat = useCallback(() => (lockRef.current ? closeChat() : openChat()), [openChat, closeChat]);

  // Put the page back at the offset it had before the stage was pinned.
  useLayoutEffect(() => {
    if (!lock && restoreY.current != null) {
      window.scrollTo(0, restoreY.current);
      restoreY.current = null;
    }
  }, [lock]);

  // Following a link in the chat list leaves the drawer at once so the next screen shows normally.
  useEffect(() => {
    if (!lockRef.current) return;
    window.clearTimeout(timer.current);
    setShown(false);
    setLock(false);
  }, [pathname]);

  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, closeChat]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(() => ({ open: shown, openChat, closeChat, toggleChat }), [shown, openChat, closeChat, toggleChat]);

  return (
    <Ctx.Provider value={value}>
      <div className="app-stage" data-lock={lock} data-shown={shown} inert={shown} style={{ "--stage-scroll": `${lockY}px` } as React.CSSProperties}>
        <div className="app-stage__inner">{children}</div>
      </div>
      <section
        id="chat-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={tr("chat_title")}
        aria-hidden={!shown}
        inert={!shown}
        data-shown={shown}
        className="chat-drawer"
        onTouchStart={(e) => { const t = e.touches[0]; touch.current = t ? { x: t.clientX, y: t.clientY } : null; }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          const start = touch.current;
          touch.current = null;
          if (t && start && t.clientX - start.x > SWIPE_CLOSE_PX && Math.abs(t.clientY - start.y) < 50) closeChat();
        }}
      >
        <header className="chat-drawer__head">
          <button ref={closeRef} type="button" aria-label="Close chat" onClick={closeChat} className="chat-drawer__close flex h-11 w-11 items-center justify-center rounded-full">
            <ChevronRight size={24} aria-hidden />
          </button>
          <h2 className="text-lg font-bold">{tr("chat_title")}</h2>
        </header>
        <div className="chat-drawer__body">{mounted && <ChatInbox key={session} embedded />}</div>
      </section>
      <button type="button" aria-label="Close chat" tabIndex={-1} onClick={closeChat} className="chat-drawer__slice" data-shown={shown} />
    </Ctx.Provider>
  );
}
