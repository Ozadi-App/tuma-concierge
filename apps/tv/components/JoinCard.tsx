"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code that opens the join page on a phone, drawn locally so the TV needs no extra network access. */
export function Qr({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0a0a", light: "#ffffff" } })
      .then((out) => !cancelled && setSvg(out))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label={label}
      className={`overflow-hidden rounded-[1.1rem] bg-white p-[0.5rem] [&>svg]:h-full [&>svg]:w-full ${className}`}
      // The markup comes from our own encoder, never from user input.
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}

/** Always on screen during a class: how to get in. */
export function JoinCard({ code, url, participants, present, hands }: { code: string; url: string; participants: number; present: number; hands: number }) {
  return (
    <aside aria-label="How to join" className="flex w-[19rem] shrink-0 flex-col gap-[1.1rem] rounded-[1.6rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-[1.3rem]">
      <p className="text-[0.95rem] font-bold uppercase tracking-[0.18em] text-gold">Join this class</p>
      <Qr value={url} label={`QR code to join with code ${code}`} className="aspect-square w-full" />
      <div>
        <p className="text-[0.85rem] text-ink-500">or enter the code in Peebee Learn</p>
        <p className="font-mono text-[2.6rem] font-black leading-none tracking-[0.12em] text-ink" aria-label={`Code ${code.split("").join(" ")}`}>
          {code}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-[var(--border-faint)] pt-[0.9rem] text-center">
        <div>
          <dd className="text-[1.7rem] font-black leading-none text-ink">{participants}</dd>
          <dt className="mt-1 text-[0.75rem] uppercase tracking-wider text-ink-500">Joined</dt>
        </div>
        <div>
          <dd className="text-[1.7rem] font-black leading-none text-ink">{present}</dd>
          <dt className="mt-1 text-[0.75rem] uppercase tracking-wider text-ink-500">Here</dt>
        </div>
        <div>
          <dd className="text-[1.7rem] font-black leading-none text-gold">{hands}</dd>
          <dt className="mt-1 text-[0.75rem] uppercase tracking-wider text-ink-500">Hands</dt>
        </div>
      </dl>
    </aside>
  );
}
