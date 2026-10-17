"use client";

import { Check, Link2, Mail, Share2, X as Close } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ShareTarget = {
  /** The page's own address (absolute, or a path on this site). */
  url: string;
  title: string;
  /** One or two lines that go with the link in a message. */
  text: string;
};

const absolute = (url: string) => (typeof window === "undefined" || /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).toString());

/**
 * Shares a product or dish: the phone's own share sheet where the browser
 * has one (Web Share API), otherwise a box with WhatsApp, Telegram, Facebook,
 * X, email and copy link.
 */
export function ShareButton({ target, className, label = "Share" }: { target: ShareTarget; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function share() {
    const data = { title: target.title, text: target.text, url: absolute(target.url) };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        // Closing the sheet is not a failure; anything else falls back to the box.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    setOpen(true);
  }

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => void share()} aria-label={label} aria-haspopup="dialog" className={className}>
        <Share2 className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open && <ShareSheet target={target} onClose={close} />}
    </>
  );
}

function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const firstRef = useRef<HTMLAnchorElement>(null);
  const url = absolute(target.url);
  const message = `${target.text} ${url}`;
  const enc = encodeURIComponent;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: copy through a hidden field.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const options: Array<{ name: string; href: string; icon: React.ReactNode }> = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(message)}`, icon: <WhatsAppMark /> },
    { name: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(target.text)}`, icon: <TelegramMark /> },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: <FacebookMark /> },
    { name: "X", href: `https://twitter.com/intent/tweet?text=${enc(target.text)}&url=${enc(url)}`, icon: <XMark /> },
    { name: "Email", href: `mailto:?subject=${enc(target.title)}&body=${enc(`${target.text}\n\n${url}`)}`, icon: <Mail className="h-6 w-6" aria-hidden="true" /> },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className="w-full max-w-md rounded-t-3xl bg-[rgb(var(--surface-card))] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-[var(--shadow-card-hover)] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="share-sheet-title" className="text-lg font-black">Share</h2>
            <p className="truncate text-sm text-ink-500">{target.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-faint)]">
            <Close className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {options.map((option, index) => (
            <li key={option.name}>
              <a
                ref={index === 0 ? firstRef : undefined}
                href={option.href}
                target={option.name === "Email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                onClick={() => setTimeout(onClose, 300)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-gold/15 px-2 py-3 text-xs font-bold text-ink active:scale-95"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-ink-gold">{option.icon}</span>
                {option.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 truncate text-center text-xs text-ink-500">{url}</p>
        <button type="button" onClick={() => void copy()} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold active:scale-95" aria-live="polite">
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Link copied" : "Copy link"}
        </button>
      </section>
    </div>,
    document.body,
  );
}

const mark = "h-6 w-6 fill-current";
function WhatsAppMark() {
  return <svg viewBox="0 0 24 24" className={mark} aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.5-.3Z" /></svg>;
}
function TelegramMark() {
  return <svg viewBox="0 0 24 24" className={mark} aria-hidden="true"><path d="M21.9 4.6 18.8 19.3c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L7 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5l18-6.9c.8-.3 1.6.2 1.3 1.1Z" /></svg>;
}
function FacebookMark() {
  return <svg viewBox="0 0 24 24" className={mark} aria-hidden="true"><path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z" /></svg>;
}
function XMark() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" /></svg>;
}
