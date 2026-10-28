"use client";

import type { CardInput, PaymentNextAction } from "@peebee/shared";
import { Lock } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "../lib/api";

/**
 * Peebee's own card form (Flutterwave direct card — the admin switches it on
 * once PCI accreditation is verified; until then cards use Flutterwave's
 * hosted page and none of this renders).
 *
 * The card lives in React state only for the length of one payment: it is
 * never put in storage, a URL, or a log, and the parent clears it once the
 * payment has been handed on.
 */

export type CardForm = { number: string; expiry: string; cvv: string };
export const emptyCard: CardForm = { number: "", expiry: "", cvv: "" };

const INPUT = "w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold";

function formatNumber(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** The form's text turned into what the API takes, or null while it is incomplete or implausible. */
export function cardFromForm(form: CardForm): CardInput | null {
  const number = form.number.replace(/\s/g, "");
  const [month, year] = form.expiry.split("/");
  if (number.length < 12 || !month || month.length !== 2 || Number(month) < 1 || Number(month) > 12 || !year || year.length !== 2) return null;
  if (form.cvv.length < 3) return null;
  return { number, cvv: form.cvv, expiryMonth: month, expiryYear: year };
}

export function CardFields({ value, onChange, disabled }: { value: CardForm; onChange: (next: CardForm) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <input
        inputMode="numeric"
        autoComplete="cc-number"
        aria-label="Card number"
        placeholder="Card number"
        value={value.number}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, number: formatNumber(e.target.value) })}
        className={INPUT}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          inputMode="numeric"
          autoComplete="cc-exp"
          aria-label="Expiry date"
          placeholder="MM/YY"
          value={value.expiry}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, expiry: formatExpiry(e.target.value) })}
          className={INPUT}
        />
        <input
          inputMode="numeric"
          autoComplete="cc-csc"
          aria-label="Security code"
          placeholder="CVV"
          type="password"
          value={value.cvv}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          className={INPUT}
        />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Your card details are encrypted and never saved on Peebee.
      </p>
    </div>
  );
}

/** Tells the customer, before they pay, where card entry happens. */
export function CardHostedNote() {
  return <p className="text-sm text-ink-500">You&apos;ll enter your card details on Flutterwave&apos;s secure page to finish this payment.</p>;
}

/**
 * The steps a card can ask for after the first attempt: PIN (local cards),
 * billing address (some international cards), a one-time code, or the
 * bank's own 3-D Secure page. Calls `onPending` once nothing more is
 * needed — the payment then settles in the background like any other.
 */
export function CardPaymentSteps({
  paymentId,
  card,
  initial,
  onPending,
  onCancel,
}: {
  paymentId: string;
  card: CardInput;
  initial: PaymentNextAction;
  onPending: () => void;
  onCancel: () => void;
}) {
  const [action, setAction] = useState<PaymentNextAction>(initial);
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [address, setAddress] = useState({ address: "", city: "", state: "", country: "UG", zipcode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const returnUrl = window.location.href;
      const res = await api.continueCardPayment(
        paymentId,
        action.type === "otp"
          ? { otp, flowRef: action.flowRef, returnUrl }
          : { card, authorization: action.type === "pin" ? { mode: "pin", pin } : { mode: "avs", ...address }, returnUrl },
      );
      if (res.redirectUrl) { window.location.href = res.redirectUrl; return; }
      setPin("");
      setOtp("");
      if (res.nextAction && res.nextAction.type !== "redirect") setAction(res.nextAction);
      else onPending();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (action.type === "redirect") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">Your bank needs to confirm this payment.</p>
        <button type="button" onClick={() => { window.location.href = action.url; }} className="min-h-12 w-full rounded-full bg-gold px-4 text-base font-bold text-ink-gold">
          Continue to your bank
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {action.type === "pin" && (
        <>
          <p className="text-sm text-ink">Enter your card PIN to continue.</p>
          <input inputMode="numeric" type="password" autoComplete="off" aria-label="Card PIN" placeholder="Card PIN" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className={INPUT} />
        </>
      )}
      {action.type === "otp" && (
        <>
          <p className="text-sm text-ink">{action.message || "Enter the one-time code your bank sent you."}</p>
          <input inputMode="numeric" autoComplete="one-time-code" aria-label="One-time code" placeholder="One-time code" maxLength={10} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className={INPUT} />
        </>
      )}
      {action.type === "avs" && (
        <>
          <p className="text-sm text-ink">Enter the billing address your bank has for this card.</p>
          {([["address", "Street address"], ["city", "City"], ["state", "State / region"], ["zipcode", "Postal code"]] as const).map(([field, label]) => (
            <input key={field} aria-label={label} placeholder={label} value={address[field]} onChange={(e) => setAddress({ ...address, [field]: e.target.value })} className={INPUT} />
          ))}
          <input aria-label="Country code" placeholder="Country (e.g. UG)" maxLength={2} value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })} className={INPUT} />
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-base font-bold text-ink disabled:opacity-60">Cancel</button>
        <button
          type="submit"
          disabled={busy || (action.type === "pin" && pin.length < 4) || (action.type === "otp" && otp.length < 4) || (action.type === "avs" && (!address.address || !address.city || !address.state || !address.zipcode || address.country.length !== 2))}
          className="min-h-12 flex-1 rounded-full bg-gold px-4 text-base font-bold text-ink-gold disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
