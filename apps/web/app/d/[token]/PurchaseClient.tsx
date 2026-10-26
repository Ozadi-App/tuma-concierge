"use client";

import { Download, GraduationCap, Key, Lock, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";

type Purchase = {
  title: string;
  kind: string;
  storeName: string;
  fileName: string | null;
  instructions: string | null;
  hasFile: boolean;
  downloadsUsed: number;
  maxDownloads: number;
  downloadsLeft: number | null;
  expiresAt: string | null;
  canDownload: boolean;
  problem: { reason: string; message: string } | null;
  licenseKey: string | null;
  licenseLocked: "phone" | "sms" | null;
  maskedPhone: string | null;
  needsManualFulfilment: boolean;
  courseUrl: string | null;
};

export default function PurchaseClient({ token }: { token: string }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (phoneProof?: string) => {
    try {
      const res = await fetch(`${API_BASE}/v1/marketplace/digital-fulfillments/${encodeURIComponent(token)}`, {
        headers: phoneProof ? { "x-phone-proof": phoneProof } : {},
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "This link isn't valid.");
        setPurchase(null);
      } else {
        setPurchase(data.purchase);
        setError("");
      }
    } catch {
      setError("We couldn't reach Peebee. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`${API_BASE}/v1/marketplace/digital-fulfillments/${encodeURIComponent(token)}/download`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.message || "We couldn't start the download.");
      } else {
        window.location.href = data.downloadUrl;
        setNote("Your download is starting.");
      }
      await load(proof || undefined);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setNote("");
    const res = await fetch(`${API_BASE}/v1/marketplace/digital-fulfillments/${encodeURIComponent(token)}/phone-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setNote(data.message || "We couldn't send a code.");
    setChallenge(data.challenge);
    setNote(`We texted a 6-digit code to ${purchase?.maskedPhone ?? "your phone"}.`);
  }

  async function confirmCode() {
    const res = await fetch(`${API_BASE}/v1/public/phone-proof/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge, code: code.trim() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setNote(data.message || "That code isn't right.");
    setProof(data.proof);
    setNote("");
    await load(data.proof);
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-cream text-ink"><p className="text-sm font-bold text-ink-500">Opening your purchase…</p></main>;

  if (!purchase) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-cream px-6 text-center text-ink">
        <Lock className="h-10 w-10 text-gold" aria-hidden />
        <h1 className="mt-4 text-xl font-black">This link can&apos;t be opened</h1>
        <p className="mt-2 text-sm text-ink-500">{error}</p>
      </main>
    );
  }

  const isCourse = purchase.kind === "course";
  return (
    <main className="mx-auto min-h-screen max-w-md space-y-4 bg-cream px-4 py-8 text-ink">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase text-ink-500">{purchase.storeName}</p>
        <h1 className="text-2xl font-black">{purchase.title}</h1>
        <p className="flex items-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden /> Your private purchase page. Don&apos;t share this link.</p>
      </header>

      {purchase.problem && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{purchase.problem.message}</p>}

      {purchase.instructions && <p className="rounded-2xl bg-surface-muted p-3 text-sm">{purchase.instructions}</p>}

      {purchase.licenseKey && (
        <section className="rounded-2xl bg-surface-muted p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-500"><Key className="h-3.5 w-3.5" aria-hidden /> Your licence key</h2>
          <p className="mt-1 select-all break-all font-mono text-base font-black">{purchase.licenseKey}</p>
        </section>
      )}
      {purchase.licenseLocked === "phone" && (
        <section className="space-y-2 rounded-2xl bg-surface-muted p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-500"><Lock className="h-3.5 w-3.5" aria-hidden /> Your licence key is protected</h2>
          <p className="text-xs text-ink-500">To show it, we&apos;ll text a code to {purchase.maskedPhone ?? "the phone you bought with"}.</p>
          {!challenge ? (
            <button type="button" onClick={() => void sendCode()} className="min-h-11 w-full rounded-full bg-ink px-5 text-sm font-black text-cream">Text me a code</button>
          ) : (
            <div className="flex gap-2">
              <div className="field-box flex-1 rounded-xl">
                <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" aria-label="6-digit code" className="w-full p-3 font-mono text-sm font-bold focus:outline-none" />
              </div>
              <button type="button" onClick={() => void confirmCode()} className="min-h-11 rounded-full bg-gold px-5 text-sm font-black text-ink-gold">Show key</button>
            </div>
          )}
        </section>
      )}
      {purchase.licenseLocked === "sms" && <p className="rounded-2xl bg-surface-muted p-3 text-sm">Your licence key was sent to you by text message.</p>}
      {purchase.needsManualFulfilment && <p className="rounded-2xl bg-surface-muted p-3 text-sm">The store is preparing your licence key. It will appear here.</p>}

      {isCourse && purchase.courseUrl && (
        <a href={purchase.courseUrl} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-black text-ink-gold">
          <GraduationCap className="h-4 w-4" aria-hidden /> Start the course
        </a>
      )}

      {purchase.hasFile && (
        <section className="space-y-2">
          <button type="button" disabled={!purchase.canDownload || busy} onClick={() => void download()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-black text-ink-gold disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden /> {busy ? "Starting…" : `Download${purchase.fileName ? ` ${purchase.fileName}` : ""}`}
          </button>
          <p className="text-center text-xs text-ink-500">
            {purchase.downloadsLeft === null ? "Unlimited downloads" : `${purchase.downloadsLeft} download${purchase.downloadsLeft === 1 ? "" : "s"} left`}
            {purchase.expiresAt ? ` · link works until ${new Date(purchase.expiresAt).toLocaleDateString()}` : ""}
          </p>
        </section>
      )}
      {note && <p role="status" className="rounded-2xl bg-gold/15 p-3 text-sm font-semibold">{note}</p>}
    </main>
  );
}
