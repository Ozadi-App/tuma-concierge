"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { portalFetch, PortalError, setToken } from "../../lib/portal";

type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** "Continue with Google" for the merchant sign-up site. Merchant owners are
 * customer-role identities, so it uses the same customer Google sign-in as the
 * merchant app; a new Google account is created as a customer and goes on to
 * the business steps. */
export function GoogleSignIn({ onSignedIn, onError }: { onSignedIn: () => void; onError: (message: string) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Callers pass fresh closures every render; keep the latest without re-initialising Google each time.
  const handlers = useRef({ onSignedIn, onError });
  useEffect(() => { handlers.current = { onSignedIn, onError }; });

  useEffect(() => {
    const google = (window as unknown as { google?: { accounts: { id: GoogleId } } }).google;
    const node = buttonRef.current;
    if (!ready || !CLIENT_ID || !node || !google) return;
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          const r = await portalFetch<{ token: string }>("/auth/google", { method: "POST", auth: false, body: { idToken: response.credential, role: "customer" } });
          setToken(r.token);
          handlers.current.onSignedIn();
        } catch (e) {
          handlers.current.onError((e as PortalError).message);
        }
      },
    });
    const render = () => {
      const width = Math.min(400, Math.round(node.parentElement?.clientWidth ?? 0));
      if (!width) return;
      node.replaceChildren();
      google.accounts.id.renderButton(node, { type: "standard", theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline", size: "large", shape: "pill", width, text: "continue_with" });
    };
    render();
    const observer = new ResizeObserver(render);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => observer.disconnect();
  }, [ready]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => handlers.current.onError("Google could not load. Refresh the page or use your phone and password.")} />
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border-faint)]" />
        <span className="text-xs font-semibold text-ink-500">OR</span>
        <span className="h-px flex-1 bg-[var(--border-faint)]" />
      </div>
      <div className="flex min-h-[44px] justify-center"><div ref={buttonRef} /></div>
    </div>
  );
}
