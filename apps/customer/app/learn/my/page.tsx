"use client";

import type { FeeInvoice, LearnEnrollment } from "@peebee/shared";
import { ArrowLeft, BookOpen, Receipt } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LearnThumb } from "@peebee/shared/learn-thumb";
import { api, errorMessage } from "../../../lib/api";

const card = "rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))]";
const ugx = (n: number) => (n > 0 ? `UGX ${n.toLocaleString("en-UG")}` : "Free");

const STATUS_LABEL: Record<FeeInvoice["status"], string> = { unpaid: "Unpaid", partial: "Part paid", paid: "Paid", cancelled: "Cancelled" };

function InvoiceRow({ invoice, onPaid }: { invoice: FeeInvoice; onPaid: () => void }) {
  const [amount, setAmount] = useState(String(invoice.balanceUgx));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);

  async function pay() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) return setError("Enter the amount as a whole number of shillings.");
    setBusy(true);
    setError(null);
    setNeedsFunds(false);
    try {
      await api.learnPayInvoice(invoice.id, value);
      onPaid();
    } catch (err) {
      setError(errorMessage(err));
      setNeedsFunds(/wallet/i.test(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`${card} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{invoice.title}</p>
          <p className="truncate text-xs text-ink-500">
            {invoice.schoolName}
            {invoice.dueDate ? ` · due ${invoice.dueDate}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">{STATUS_LABEL[invoice.status]}</span>
      </div>
      <p className="text-xs text-ink-500">
        {ugx(invoice.paidUgx)} paid of {ugx(invoice.amountUgx)}
      </p>
      {invoice.status !== "paid" && (
        <div className="space-y-2">
          <label htmlFor={`pay-${invoice.id}`} className="block text-xs font-semibold text-ink-500">
            Amount to pay now (UGX)
          </label>
          <div className="flex gap-2">
            <input
              id={`pay-${invoice.id}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={invoice.balanceUgx}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] text-sm text-ink outline-none focus:border-gold"
            />
            <button type="button" onClick={pay} disabled={busy} className="shrink-0 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink-gold disabled:opacity-50">
              {busy ? "Paying…" : "Pay from wallet"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}{" "}
              {needsFunds && (
                <Link href="/wallet" className="font-semibold underline">
                  Open your wallet
                </Link>
              )}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function MyLearningPage() {
  const [enrollments, setEnrollments] = useState<LearnEnrollment[] | null>(null);
  const [invoices, setInvoices] = useState<FeeInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, i] = await Promise.all([api.learnEnrollments(), api.learnInvoices()]);
      setEnrollments(e.enrollments);
      setInvoices(i.invoices);
      setError(null);
    } catch (err) {
      setEnrollments([]);
      setInvoices([]);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-10">
      <div className="space-y-1">
        <Link href="/learn" className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Learn
        </Link>
        <h1 className="text-xl font-bold text-ink">My learning</h1>
        <Link href="/learn/live" className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink-gold">
          Join a live class
        </Link>
        <Link href="/learn/certificates" className="mt-2 ml-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-faint)] px-3.5 py-2 text-xs font-semibold text-ink">
          🎓 Certificates and badges
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-sm text-ink">
          {error}
        </p>
      )}

      <section aria-labelledby="courses-h" className="space-y-3">
        <h2 id="courses-h" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BookOpen className="h-4 w-4 text-gold" aria-hidden /> My courses
        </h2>
        {enrollments === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
        ) : enrollments.length === 0 ? (
          <div className={`${card} p-5 text-sm text-ink-500`}>
            You haven&apos;t joined a course yet.{" "}
            <Link href="/learn" className="font-semibold text-gold underline">
              Browse courses
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((e) => (
              <li key={e.id}>
                <Link href={`/learn/course/${e.courseId}`} className={`${card} block space-y-2 p-3 transition hover:border-gold/50`}>
                  <div className="flex gap-3">
                    <LearnThumb src={api.learnArtUrl("course", e.courseId)} className="w-24 shrink-0 self-start rounded-xl" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-semibold text-ink">{e.title}</p>
                      <p className="text-xs text-ink-500">{e.schoolName}</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]" role="progressbar" aria-valuenow={e.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${e.title} progress`}>
                    <div className="h-full rounded-full bg-gold" style={{ width: `${e.progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-ink-500">
                    {e.completedLessons} of {e.lessonCount} lessons · {e.progressPercent}%
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fees-h" className="space-y-3">
        <h2 id="fees-h" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Receipt className="h-4 w-4 text-gold" aria-hidden /> School fees
        </h2>
        {invoices === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />
        ) : invoices.length === 0 ? (
          <div className={`${card} p-5 text-sm text-ink-500`}>No fees to pay. When a school sends you an invoice, it appears here and you pay it from your Peebee wallet.</div>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onPaid={() => void load()} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
