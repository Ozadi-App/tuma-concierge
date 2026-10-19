"use client";

import type { LearnerCertificate } from "@peebee/shared";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../../lib/api";

export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<LearnerCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.learnCertificate(id).then((r) => setCert(r.certificate)).catch((err) => setError(errorMessage(err)));
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-28">
      <Link href="/learn/certificates" className="inline-flex items-center gap-1 text-xs font-semibold text-gold print:hidden">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Certificates
      </Link>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">{error}</p>}
      {cert && (
        <>
          <article className="space-y-5 rounded-3xl border-4 border-double border-gold bg-[rgb(var(--surface-card))] p-8 text-center shadow-sm" aria-label="Certificate">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Certificate of completion</p>
            <p className="text-sm text-ink-500">This certifies that</p>
            <h1 className="text-3xl font-bold text-ink">{cert.learnerName}</h1>
            <p className="text-sm text-ink-500">has completed</p>
            <h2 className="text-2xl font-bold text-ink">{cert.courseTitle}</h2>
            <p className="text-sm text-ink-500">{cert.schoolName}</p>
            {cert.scorePercent !== null && <p className="text-sm font-semibold text-ink">Average score {cert.scorePercent}%</p>}
            <p className="text-xs text-ink-500">
              Issued {new Date(cert.issuedAt.replace(" ", "T") + "Z").toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })} · Code <span className="font-mono font-bold tracking-wider text-ink">{cert.code}</span>
            </p>
          </article>
          <button type="button" onClick={() => window.print()} className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3.5 text-base font-bold text-ink-gold print:hidden">
            <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
          </button>
        </>
      )}
    </div>
  );
}
