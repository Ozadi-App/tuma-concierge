"use client";

import { Copy, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";

/** How to run the stream from a second phone: open Peebee there signed in as the host, or give a helper the code. */
export function HelperSheet({ open, onClose, streamId }: { open: boolean; onClose: () => void; streamId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || code) return;
    api.liveHelperCode(streamId).then((r) => setCode(r.code)).catch((e) => setError(errorMessage(e)));
  }, [open, code, streamId]);

  if (!open) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the code is on screen to read out */ }
  }
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60 p-4" role="dialog" aria-modal aria-label="Add a helper device">
      <div className="w-full space-y-4 rounded-[28px] bg-[rgb(var(--surface-card))] p-5 text-ink">
        <div className="flex items-center gap-3"><Smartphone className="h-6 w-6 text-gold" aria-hidden /><h2 className="text-lg font-extrabold">Add a helper device</h2></div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-500">
          <li>On the other phone, open Peebee and go to <b className="text-ink">{origin.replace(/^https?:\/\//, "")}/live/helper</b>.</li>
          <li>Signed in as you? It opens by itself. Someone else helping? They type this code:</li>
        </ol>
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : (
          <button type="button" onClick={() => void copy()} aria-label="Copy the helper code" className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[rgb(var(--surface-muted))] py-4 text-3xl font-extrabold tracking-[0.3em] tabular-nums">
            {code ?? "······"}<Copy className="h-5 w-5 text-ink-500" aria-hidden />
          </button>
        )}
        {copied && <p role="status" className="text-center text-xs font-semibold text-green">Copied</p>}
        <p className="text-xs text-ink-500">A helper can read comments, hide or pin them, and reply. They cannot end your stream.</p>
        <button type="button" onClick={onClose} className="min-h-12 w-full rounded-full bg-gold px-6 text-sm font-bold text-ink-gold">Done</button>
      </div>
    </div>
  );
}
