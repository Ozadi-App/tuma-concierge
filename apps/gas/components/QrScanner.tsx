"use client";

import { Camera, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type QrScannerProps = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export function QrScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detectorTimer: NodeJS.Timeout | null = null;

    async function initCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setHasCamera(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check if BarcodeDetector is supported
        if ("BarcodeDetector" in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          detectorTimer = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  onScan(barcodes[0].rawValue);
                }
              } catch {}
            }
          }, 400);
        }
      } catch (err: any) {
        setHasCamera(false);
        setError("Camera permission denied or camera not found.");
      }
    }

    void initCamera();

    return () => {
      if (detectorTimer) clearInterval(detectorTimer);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScan]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gold" />
          <h2 className="text-base font-bold">Scan Rider Fuel QR</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Viewfinder Area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
        {hasCamera ? (
          <>
            <video ref={videoRef} playsInline className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-64 w-64 rounded-2xl border-2 border-gold/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                {/* Crosshairs */}
                <span className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-gold" />
                <span className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-gold" />
                <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-gold" />
                <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-gold" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-gold/70" />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 p-6 text-center">
            <Camera className="mx-auto h-12 w-12 text-zinc-500" />
            <p className="text-sm text-zinc-300">
              Camera preview unavailable. You can enter or paste the rider's 6-digit code below.
            </p>
            {error && <p className="text-xs text-amber-400">{error}</p>}
          </div>
        )}
      </div>

      {/* Manual Code / Demo Trigger Below Viewfinder */}
      <div className="pt-4 space-y-3">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="e.g. 738291 or PBGAS-…"
            className="min-h-12 flex-1 rounded-xl bg-white/10 px-4 text-center font-mono text-base font-bold tracking-widest text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-gold"
          />
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-gold px-5 font-bold text-ink-gold"
          >
            Verify
          </button>
        </form>

        {/* Demo Code Quick Buttons for testing */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Test rider sample:</span>
          <button
            type="button"
            onClick={() => onScan("738291")}
            className="font-mono font-bold text-gold underline underline-offset-2"
          >
            Use Code 738291
          </button>
        </div>
      </div>
    </div>
  );
}
