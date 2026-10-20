"use client";
import { useState } from "react";

/**
 * A picture for a school, course or lesson. `src` is the Learn art URL, so there is always something to show;
 * if it still fails to load the space stays filled with the muted surface instead of a broken-image icon.
 */
export function LearnThumb({ src, className = "", alt = "", ratio = "16 / 9" }: { src: string; className?: string; alt?: string; /** Defaults to 16:9 like every other Learn picture; the Learn home passes "15 / 9". */ ratio?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ aspectRatio: ratio }} className={`relative overflow-hidden bg-[rgb(var(--surface-muted))] ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
    </div>
  );
}
