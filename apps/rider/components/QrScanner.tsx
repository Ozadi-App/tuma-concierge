"use client";

import { Camera, X } from "lucide-react";
import { startQrCamera, type QrCameraHandle } from "@peebee/shared/qr";
import { useEffect, useRef, useState } from "react";

/** Full-screen QR scanner (works on every phone and browser) with a typed-code fallback. */
export function QrScanner({ title, onScan, onClose }: { title: string; onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [manualCode, setManualCode] = useState("");

  // Hold the latest callback so the camera starts once and is not restarted when the parent re-renders.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  useEffect(() => {
    let handle: QrCameraHandle | null = null;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    startQrCamera(video, (value) => onScanRef.current(value))
      .then((started) => { if (cancelled) started.stop(); else handle = started; })
      .catch(() => { if (!cancelled) setHasCamera(false); });
    return () => { cancelled = true; handle?.stop(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gold" aria-hidden />
          <h2 className="text-base font-bold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        {hasCamera ? (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-64 w-64 rounded-2xl border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            </div>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-white/70">Camera unavailable. Type the 6-digit code below.</p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) onScan(manualCode.trim());
        }}
        className="flex gap-2 pt-4"
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          className="min-h-12 flex-1 rounded-xl px-4 text-center font-mono text-base font-bold tracking-widest"
        />
        <button type="submit" disabled={manualCode.length !== 6} className="min-h-12 rounded-xl bg-gold px-5 font-bold text-ink-gold disabled:opacity-60">
          OK
        </button>
      </form>
    </div>
  );
}
