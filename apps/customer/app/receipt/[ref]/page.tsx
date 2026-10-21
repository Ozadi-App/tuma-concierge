"use client";

import type { PublicReceipt } from "@peebee/shared";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../../lib/api";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;

/** What scanning a receipt's QR opens: confirms Peebee issued it, and shows what it was for. Needs no sign-in. */
export default function ReceiptVerifyPage() {
  const { ref } = useParams<{ ref: string }>();
  const reference = decodeURIComponent(ref ?? "");
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    api.verifyReceipt(reference)
      .then((r) => { if (live) setReceipt(r); })
      .catch((err) => { if (live) setError(errorMessage(err)); })
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [reference]);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-6">
      {!loaded ? (
        <p className="text-sm text-ink-500" role="status">Checking this receipt…</p>
      ) : receipt ? (
        <>
          <section className="home-card space-y-2 border border-green/30 bg-green/10 p-5 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-green" aria-hidden />
            <h1 className="text-xl font-black text-ink">Genuine Peebee receipt</h1>
            <p className="text-sm text-ink-500">{receipt.title}{receipt.demo ? " · practice money, not real" : ""}</p>
          </section>
          <section className="home-card space-y-2 p-5 text-sm">
            <p className="text-center text-3xl font-black text-ink">{ugx(receipt.amountUgx)}</p>
            <p className="text-center text-xs text-ink-500">{new Date(receipt.issuedAt.includes("T") ? receipt.issuedAt : `${receipt.issuedAt.replace(" ", "T")}Z`).toLocaleString("en-UG")}</p>
            <div className="space-y-1.5 pt-2">
              {receipt.lines.map((line) => (
                <div key={line.label} className="flex items-start justify-between gap-3">
                  <span className="text-ink-500">{line.label}</span>
                  <span className="text-right font-bold text-ink">{line.value}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="home-card space-y-2 border border-red-300 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950/30" role="alert">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden />
          <h1 className="text-xl font-black text-ink">Not a Peebee receipt</h1>
          <p className="text-sm text-ink-500">{error || "No Peebee receipt has this reference."}</p>
          <p className="break-all font-mono text-xs text-ink-500">{reference}</p>
        </section>
      )}
    </main>
  );
}
