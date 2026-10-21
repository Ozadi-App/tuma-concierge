"use client";

import { useMemo } from "react";
import { qrSvg } from "./qr.js";

/** A scannable QR for a short code, drawn as one crisp SVG on a white tile (readable on light and dark screens). */
export function QrCode({ value, size = 200, className = "", label }: { value: string; size?: number; className?: string; label?: string }) {
  const drawn = useMemo(() => {
    try { return qrSvg(value); } catch { return null; }
  }, [value]);
  if (!drawn) {
    return <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-2xl bg-zinc-100 text-xs text-zinc-500">Can&apos;t draw this code</div>;
  }
  const total = drawn.size;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} width={size} height={size} className={`rounded-2xl bg-white ${className}`} shapeRendering="crispEdges" role="img" aria-label={label ?? `QR code ${value}`}>
      <rect width={total} height={total} fill="#ffffff" />
      <path d={drawn.path} fill="#0A0A0A" />
    </svg>
  );
}
