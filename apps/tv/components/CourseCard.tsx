"use client";

import Link from "next/link";
import { useState } from "react";
import { courseArt } from "../lib/api";

/** A course as a card the remote can land on: its picture, name, school and (for a course you're taking) how far you are. */
export function CourseCard({ id, href, title, subtitle, badge, progress }: { id: string; href: string; title: string; subtitle: string; badge?: string; progress?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <Link
      href={href}
      data-focusable
      className="block h-full overflow-hidden rounded-[1.3rem] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] focus:bg-gold focus:text-ink-gold"
    >
      <div className="relative aspect-video w-full bg-[rgb(var(--surface-muted))]">
        {!broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={courseArt(id)} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        )}
        {badge && <span className="absolute right-[0.7rem] top-[0.7rem] rounded-full bg-black/70 px-[0.8rem] py-[0.2rem] text-[0.9rem] font-bold text-white">{badge}</span>}
      </div>
      <div className="space-y-[0.4rem] p-[1rem]">
        <p className="line-clamp-2 text-[1.3rem] font-black leading-tight">{title}</p>
        <p className="line-clamp-2 text-[0.95rem] opacity-75">{subtitle}</p>
        {progress !== undefined && (
          <div className="pt-[0.3rem]">
            <div className="h-[0.5rem] overflow-hidden rounded-full bg-black/30" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-[0.3rem] text-[0.9rem] opacity-75">{progress === 0 ? "Not started" : progress === 100 ? "Finished" : `${progress}% done`}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
