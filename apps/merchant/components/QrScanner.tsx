"use client";

import { Camera, X } from "lucide-react";
import { startQrCamera, type QrCameraHandle } from "@peebee/shared/qr";
import { useEffect, useRef, useState } from "react";

/** Camera QR scanner (works on every phone and browser) with a typed-code fallback. */
export function QrScanner({
  onScan,
  onClose,
  title = "Scan QR",
  placeholder = "Payment code",
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => { if (!cancelled) { setHasCamera(false); setError("Camera not available."); } });
    return () => { cancelled = true; handle?.stop(); };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) onScan(manualCode.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gold" />
          <h2 className="text-base font-bold">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        {hasCamera ? (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-64 w-64 rounded-2xl border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-gold/70" />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 p-6 text-center">
            <Camera className="mx-auto h-12 w-12 text-white/40" />
            <p className="text-sm text-white/70">Type the code below.</p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-4">
        {error && <p className="text-xs text-gold">{error}</p>}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder={placeholder}
            className="min-h-12 flex-1 rounded-xl px-4 text-center font-mono text-base font-bold tracking-widest text-ink outline-none focus:ring-2 focus:ring-gold"
          />
          <button type="submit" className="min-h-12 rounded-xl bg-gold px-5 font-bold text-ink-gold">
            Use
          </button>
        </form>
      </div>
    </div>
  );
}
