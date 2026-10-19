"use client";

import type { LearnerBadge, LearnerCertificate } from "@peebee/shared";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";

export default function CertificatesPage() {
  const [certs, setCerts] = useState<LearnerCertificate[] | null>(null);
  const [badges, setBadges] = useState<LearnerBadge[]>([]);
  const [badgesOn, setBadgesOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.learnCertificates().then((r) => setCerts(r.certificates)).catch((err) => setError(errorMessage(err)));
    api.learnBadges().then((r) => { setBadges(r.badges); setBadgesOn(r.enabled); }).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-28">
      <div className="space-y-1">
        <Link href="/learn/my" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> My learning
        </Link>
        <h1 className="text-xl font-bold text-ink">Certificates and badges</h1>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">{error}</p>}

      <section aria-labelledby="certs-h" className="space-y-3">
        <h2 id="certs-h" className="text-sm font-semibold text-ink">Certificates</h2>
        {certs === null ? (
          <div className="h-20 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
        ) : certs.length === 0 ? (
          <p className="text-sm text-ink-500">Finish every item of a class and your certificate appears here.</p>
        ) : (
          <ul className="space-y-2">
            {certs.map((c) => (
              <li key={c.id}>
                <Link href={`/learn/certificates/${c.id}`} className={`${card} flex items-center gap-3 p-4`}>
                  <span className="text-2xl" aria-hidden>🎓</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{c.courseTitle}</span>
                    <span className="block truncate text-xs text-ink-500">{c.schoolName} · {new Date(c.issuedAt.replace(" ", "T") + "Z").toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {badgesOn && (
        <section aria-labelledby="badges-h" className="space-y-3">
          <h2 id="badges-h" className="text-sm font-semibold text-ink">Badges</h2>
          <ul className="grid grid-cols-2 gap-3">
            {badges.map((b) => (
              <li key={b.key} className={`${card} space-y-1 p-4 text-center ${b.awardedAt ? "" : "opacity-50"}`}>
                <span className={`block text-3xl ${b.awardedAt ? "" : "grayscale"}`} aria-hidden>{b.icon}</span>
                <span className="block text-sm font-bold text-ink">{b.title}</span>
                <span className="block text-xs text-ink-500">{b.awardedAt ? "Earned" : b.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
