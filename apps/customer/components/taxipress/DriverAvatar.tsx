"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** The driver's profile photo, or their initials when there is none. */
export function DriverAvatar({ name, photoUrl, dark = false }: { name: string | null | undefined; photoUrl: string | null | undefined; dark?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!photoUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    api.taxipressDriverPhotoBlob(photoUrl)
      .then((blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } })
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); setSrc(null); };
  }, [photoUrl]);
  const ring = dark ? "bg-white/15 text-white" : "bg-gold/15 text-gold";
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${ring}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- object URL from an authed blob */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
