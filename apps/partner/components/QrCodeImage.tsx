"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Renders `value` as a scannable QR code image. */
export function QrCodeImage({ value, size = 168, label }: { value: string; size?: number; label?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 3, width: size * 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div style={{ width: size, height: size }} className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? `QR code ${value}`} width={size - 16} height={size - 16} className="h-full w-full" />
      )}
    </div>
  );
}
