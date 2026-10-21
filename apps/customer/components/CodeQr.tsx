"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR image of a short code (e.g. a relay collection code). */
export function CodeQr({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 3, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} className="rounded-xl bg-white" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={`QR code ${value}`} className="rounded-xl bg-white" />;
}
