"use client";

import { Download, Share2, PlusSquare, Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "peebee_gas_install_dismissed_at";
const DISMISS_DAYS = 7;
export const PWA_LOGIN_PROMPT_KEY = "peebee_gas_prompt_pwa_on_login";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      sessionStorage.removeItem(PWA_LOGIN_PROMPT_KEY);
      return;
    }

    const ios = isIos();
    setIsIosDevice(ios);

    // Listen for beforeinstallprompt event (Chromium/Android/Edge)
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Check if user just logged in
    const justLoggedIn = sessionStorage.getItem(PWA_LOGIN_PROMPT_KEY) === "1";
    if (justLoggedIn) {
      setShowModal(true);
    } else {
      // Check 7-day dismissal window for ambient banner
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      const isDismissed = dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
      if (!isDismissed) {
        setShowBanner(true);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [pathname]);

  function dismissModal() {
    setShowModal(false);
    sessionStorage.removeItem(PWA_LOGIN_PROMPT_KEY);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  function dismissBanner() {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  async function handleInstall() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setDeferred(null);
      }
    }
    dismissModal();
    setShowBanner(false);
  }

  // Do not show on auth pages or verify pages
  const isAuthPage = pathname === "/login" || pathname === "/apply";
  if (isStandalone() || isAuthPage) return null;

  return (
    <>
      {/* Prominent Modal Sheet triggered upon successful login */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface))] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192.png?v=logo-6"
                  alt="Peebee Gas"
                  className="h-12 w-12 shrink-0 rounded-2xl shadow-md border border-gold/30"
                />
                <div>
                  <h2 id="pwa-install-title" className="text-base font-black text-ink">
                    Install Peebee Gas App
                  </h2>
                  <p className="text-xs font-medium text-ink-500">
                    Station Terminal & Management
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissModal}
                aria-label="Close"
                className="rounded-full p-1 text-ink-500 hover:text-ink transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              Install Peebee Gas to your home screen for quick single-tap pump terminal access, full-screen keypad, and offline speed.
            </p>

            {/* iOS Instructions */}
            {isIosDevice ? (
              <div className="rounded-2xl bg-[var(--surface-muted)] p-3.5 space-y-2 border border-[var(--border-faint)]">
                <p className="text-[11px] font-bold text-ink flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-gold shrink-0" />
                  <span>How to install on iPhone & iPad:</span>
                </p>
                <ol className="text-[11px] text-ink-500 space-y-1.5 list-decimal list-inside leading-tight font-medium">
                  <li className="flex items-start gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-ink shrink-0 mt-0.5" />
                    <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <PlusSquare className="h-3.5 w-3.5 text-ink shrink-0 mt-0.5" />
                    <span>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</span>
                  </li>
                  <li>
                    Tap <strong>&quot;Add&quot;</strong> in the top right corner.
                  </li>
                </ol>
              </div>
            ) : null}

            <div className="space-y-2 pt-1">
              {!isIosDevice && deferred ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-xs font-bold text-ink-gold shadow-md transition hover:brightness-105 active:scale-[0.99]"
                >
                  <Download className="h-4 w-4" strokeWidth={2.5} />
                  <span>Install App to Device</span>
                </button>
              ) : !isIosDevice ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-xs font-bold text-ink-gold shadow-md transition hover:brightness-105 active:scale-[0.99]"
                >
                  <Download className="h-4 w-4" strokeWidth={2.5} />
                  <span>Add to Home Screen</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={dismissModal}
                className="flex h-10 w-full items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-xs font-bold text-ink transition hover:bg-[rgb(var(--surface-muted))]"
              >
                <span>Continue to Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive bottom banner if modal is closed and not dismissed */}
      {!showModal && showBanner && (
        <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto max-w-lg px-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png?v=logo-6"
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl border border-gold/20"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-ink">Install Peebee Gas</p>
              <p className="truncate text-[11px] text-ink-500">
                {isIosDevice
                  ? 'Tap Share, then "Add to Home Screen"'
                  : "Add to home screen for faster station access"}
              </p>
            </div>
            {!isIosDevice && (
              <button
                type="button"
                onClick={() => {
                  if (deferred) handleInstall();
                  else setShowModal(true);
                }}
                className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-ink-gold shadow-sm"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>Install</span>
              </button>
            )}
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="shrink-0 p-1 text-ink-500 hover:text-ink transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
