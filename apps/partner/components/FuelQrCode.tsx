"use client";

import { QrCode } from "@peebee/shared/qr-code";

/** The rider's fuel QR, shown to the pump attendant. A standards-correct QR (the old hand-drawn one could not be read). */
export function FuelQrCode({ value, size = 200, className = "" }: { value: string; size?: number; className?: string }) {
  return <QrCode value={value} size={size} className={`p-2.5 shadow-sm ${className}`} label={`QR Code for ${value}`} />;
}
