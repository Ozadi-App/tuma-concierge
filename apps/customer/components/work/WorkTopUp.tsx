"use client";

import { Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { MobileNumberPicker } from "../MobileNumberPicker";
import { cardClass, Notice, primaryBtn, secondaryBtn } from "./WorkUI";
import { formatUgx } from "./work-utils";

/** How often, and for how long, we ask the server whether the top-up landed. */
const POLL_MS = 3000;
const GIVE_UP_MS = 3 * 60_000;

type Phase = "form" | "starting" | "pending" | "failed" | "timeout" | "credited";

/**
 * Inline "top up and carry on" for a 402 insufficient_wallet. It starts a normal wallet
 * top-up, waits for the SERVER to say it was credited, then calls `onCredited` so the caller
 * retries the original action with the same idempotency key. Nothing is ever marked paid here.
 */
export function WorkTopUp({ neededUgx, onCredited }: { neededUgx: number; onCredited: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [msisdn, setMsisdn] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [topupId, setTopupId] = useState<string | null>(null);
  const [pollNonce, setPollNonce] = useState(0);
  const firedRef = useRef(false);
  const creditedRef = useRef(onCredited);
  creditedRef.current = onCredited;

  useEffect(() => {
    api
      .getWallet()
      .then((w) => setBalance(w.balance))
      .catch(() => setBalance(null));
  }, []);

  const shortfall = Math.max(0, neededUgx - (balance ?? 0));
  const amount = shortfall > 0 ? shortfall : neededUgx;

  const settle = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setPhase("credited");
    creditedRef.current();
  }, []);

  // Ask the server until it says the top-up is credited, failed, or we run out of patience.
  useEffect(() => {
    if (!topupId || phase !== "pending") return;
    const started = Date.now();
    let stopped = false;
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        if (!stopped) setPhase("timeout");
        return;
      }
      api
        .refreshTopup(topupId)
        .then((res) => {
          if (stopped) return;
          if (res.topup.status === "successful") {
            clearInterval(timer);
            settle();
          } else if (res.topup.status === "failed") {
            clearInterval(timer);
            setPhase("failed");
          }
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [topupId, phase, pollNonce, settle]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "starting" || !msisdn.trim()) return;
    setPhase("starting");
    setError(null);
    try {
      const res = await api.topUpWallet({ amount, msisdn: msisdn.trim() });
      setTopupId(res.topupId);
      setRedirectUrl(res.redirectUrl ?? null);
      firedRef.current = false;
      setPhase("pending");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("form");
    }
  }

  return (
    <section className={`${cardClass} space-y-3`} aria-label="Top up your wallet">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Smartphone className="h-4 w-4 text-gold" aria-hidden /> Top up to continue
      </h2>
      <p className="text-sm text-ink-500">
        You need {formatUgx(neededUgx)} for this{balance != null ? ` and your wallet has ${formatUgx(balance)}` : ""}. Short by {formatUgx(amount)}.
      </p>

      {phase === "pending" || phase === "credited" ? (
        <div role="status" className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden />
            <p className="text-sm">{phase === "credited" ? "Wallet topped up. Finishing your request..." : "Waiting for your payment. Approve the prompt on your phone."}</p>
          </div>
          {redirectUrl && phase === "pending" ? (
            <a href={redirectUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-bold text-gold underline">
              Open the payment page
            </a>
          ) : null}
        </div>
      ) : phase === "timeout" ? (
        <div className="space-y-2">
          <Notice tone="info" text="We haven't seen the payment yet. If you approved it, it can take a minute more. Nothing has been charged for the job." />
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              setPhase("pending");
              setPollNonce((n) => n + 1);
            }}
          >
            Keep waiting
          </button>
          <button type="button" className={secondaryBtn} onClick={() => setPhase("form")}>
            Try a different number
          </button>
        </div>
      ) : (
        <form onSubmit={start} className="space-y-2">
          {phase === "failed" ? <Notice text="The top-up didn't go through and you haven't been charged. You can try again." /> : null}
          <Notice text={error ?? undefined} />
          <MobileNumberPicker purpose="payment" value={msisdn} onChange={setMsisdn} />
          <button type="submit" disabled={phase === "starting" || !msisdn.trim()} className={primaryBtn}>
            {phase === "starting" ? "Starting..." : `Top up ${formatUgx(amount)} with mobile money`}
          </button>
        </form>
      )}
    </section>
  );
}
