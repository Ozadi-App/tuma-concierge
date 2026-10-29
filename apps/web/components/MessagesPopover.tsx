"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, MessagesSquare } from "lucide-react";
import { APP_URL } from "../lib/content";

/** The chat button from the app header. It shows what chat and updates look like. Nothing here is real. */
export function MessagesPopover() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  return (
    <div className="msgs" ref={box}>
      <button type="button" className="icon-btn" aria-label="Chat and updates, a sample" aria-expanded={open} aria-controls="msgs-pop" onClick={() => setOpen(!open)}>
        <MessagesSquare size={20} aria-hidden />
        <i className="msgs-dot" aria-hidden />
      </button>
      {open && (
        <div id="msgs-pop" className="msgs-pop" role="dialog" aria-label="Chat and updates, a sample">
          <p className="sample-tag">Sample</p>
          <p className="msgs-h">Chat sits on the order</p>
          <div className="msgs-chat">
            <p className="ph-bub">I am at the gate.</p>
            <p className="ph-bub ph-bub-me">Coming down now.</p>
          </div>
          <p className="msgs-h"><Bell size={14} aria-hidden /> Updates</p>
          <ul className="msgs-list">
            <li>Matched. Your rider is on the way.</li>
            <li>Funded. The money is held in escrow.</li>
            <li>Handover. Give the PIN when it arrives.</li>
          </ul>
          <a className="msgs-more" href={APP_URL}>Open Peebee for your own chats</a>
        </div>
      )}
    </div>
  );
}
