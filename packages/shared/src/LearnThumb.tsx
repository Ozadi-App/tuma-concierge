"use client";
import { useState } from "react";

/**
 * A 16:9 picture for a school, course or lesson. `src` is the Learn art URL, so there is always something to show;
 * if it still fails to load the space stays filled with the muted surface instead of a broken-image icon.
 */
export function LearnThumb({ src, className = "", alt = "" }: { src: string; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-video overflow-hidden bg-[rgb(var(--surface-muted))] ${className}`}>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
    </div>
  );
}
