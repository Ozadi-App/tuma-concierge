"use client";

import type { ChatMessage, OrderDetail } from "@peebee/shared";
import { detectMobileMoneyNetwork, mobileMoneyNetworkLabel, observeNotificationSnapshot } from "@peebee/shared";
import { BellRing, Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderBreakdown } from "../../../../components/OrderBreakdown";
import { api, errorMessage } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { enableGuestAlerts, findGuestSession, guestAlertsSupported, guestClient, guestStageText, type GuestSession } from "../../../../lib/guest";
import { formatUgx } from "../../../../lib/order-display";
import { useLivePolling } from "../../../../lib/use-live-polling";

type Quote = Awaited<ReturnType<ReturnType<typeof guestClient>["getOrderCheckout"]>>;
const STEPS = ["Payment", "Finding a rider", "Collecting", "On the way", "Arrived", "Delivered"];

export default function GuestOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, setSession } = useAuth();
  const [session, setSessionState] = useState<GuestSession | null | undefined>(undefined);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [cardAvailable, setCardAvailable] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alerts, setAlerts] = useState<"idle" | "on" | "blocked">("idle");
  const [canCreateAccount, setCanCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const polling = useRef(false);
  const paying = useRef(false);

  useEffect(() => {
    const found = findGuestSession(id);
    setSessionState(found);
    if (found?.phone) setPhone(found.phone);
  }, [id]);

  const client = useMemo(() => (session ? guestClient(session.token) : null), [session]);

  useEffect(() => {
    api.getGuestConfig().then((cfg) => setCardAvailable(cfg.cardAvailable)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    api.guestTrack(session.trackingCode).then((t) => setCanCreateAccount(t.canCreateAccount)).catch(() => {});
  }, [session]);

  const load = useCallback(async () => {
    if (!client || polling.current) return;
    polling.current = true;
    try {
      const current = await client.getOrder(id);
      const pending = current.payments.find((p) => p.type === "collection" && ["pending", "unknown"].includes(p.status));
      if (pending) await client.refreshPayment(pending.id).catch(() => {});
      const refreshed = pending ? await client.getOrder(id) : current;
      setDetail(refreshed);
      const paid = refreshed.payments.some((p) => p.type === "collection" && p.status === "successful");
      if (!paid && ["Create", "Match", "Fund"].includes(refreshed.order.stage)) setQuote(await client.getOrderCheckout(id).catch(() => null));
      const chat = await client.getChat(id).catch(() => null);
      if (chat) {
        setMessages(chat.messages);
        // Plays the notification sound when a new update arrives (the first load is only a baseline).
        observeNotificationSnapshot(`guest-order:${id}`, [...chat.messages.map((m) => m.id), ...refreshed.events.map((e) => e.id)]);
      }
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      polling.current = false;
    }
  }, [client, id]);
  useLivePolling(() => void load(), 5000, [load]);

  if (session === undefined) return null;
  if (!session || !client) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 pt-10 text-ink">
        <h1 className="text-2xl font-black">Find your order</h1>
        <p className="text-sm text-ink-500">This order was placed on another device. Enter your tracking code to continue.</p>
        <Link href="/guest/track" className="flex min-h-12 items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-ink-gold">Track with my code</Link>
      </div>
    );
  }

  const order = detail?.order;
  const paid = detail?.payments.some((p) => p.type === "collection" && p.status === "successful") ?? false;
  const pending = detail?.payments.some((p) => p.type === "collection" && ["pending", "unknown"].includes(p.status)) ?? false;
  const failed = detail?.payments.some((p) => p.type === "collection" && p.status === "failed") ?? false;
  const stage = order ? guestStageText(String(order.stage), paid) : null;
  const amount = quote?.mobileMoney ?? null;
  const network = detectMobileMoneyNetwork(phone);
  const needsPayment = !!order && !paid && ["Create", "Match", "Fund"].includes(String(order.stage));
  const payDisabled = busy || pending || amount == null || !network;
  const updates = messages.filter((m) => (m.sender_role as string) === "system" || m.sender_role === "rider").slice(-6).reverse();

  async function pay() {
    if (payDisabled || paying.current || amount == null) return;
    paying.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await client!.fundOrder(id, { paymentMethod: "mobile_money", acceptedAmount: amount, msisdn: phone });
      if (result.redirectUrl) { window.location.href = result.redirectUrl; return; }
      await load();
    } catch (err) {
      setError(errorMessage(err));
      await load();
    } finally {
      paying.current = false;
      setBusy(false);
    }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(session!.trackingCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  async function turnOnAlerts() {
    setAlerts((await enableGuestAlerts(session!.token)) ? "on" : "blocked");
  }

  async function createAccount() {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await api.guestCreateAccount(session!.trackingCode, phone || session!.phone || "", password);
      setSession(res.token, res.user);
      router.push(`/orders/${id}`);
    } catch (err) {
      setAccountError(errorMessage(err));
      setAccountBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pb-32 pt-4 text-ink">
      <header className="home-card space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Your tracking code</p>
        <p className="text-3xl font-black tracking-wider text-gold" data-testid="tracking-code">{session.trackingCode}</p>
        <button type="button" onClick={() => void copyCode()} className="mx-auto flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-faint)] px-4 text-sm font-semibold">
          {copied ? <Check className="h-4 w-4 text-gold" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy code"}
        </button>
        <p className="text-xs text-ink-500">Keep this code. Sign in to track your order, or wait for our updates.</p>
      </header>

      {stage && (
        <section className="home-card space-y-3" aria-live="polite" aria-label="Order status">
          <p className="text-lg font-bold">{stage.label}</p>
          <p className="text-sm text-ink-500">{stage.detail}</p>
          {stage.step >= 0 && (
            <ol className="flex gap-1" aria-label="Progress">
              {STEPS.map((label, i) => (
                <li key={label} className={`h-1.5 flex-1 rounded-full ${i <= stage.step ? "bg-gold" : "bg-[rgb(var(--surface-muted))]"}`} title={label} />
              ))}
            </ol>
          )}
        </section>
      )}

      {needsPayment && (
        <section className="home-card space-y-4" aria-label="Payment">
          <h2 className="text-lg font-bold">{cardAvailable ? "Pay with mobile money or card" : "Pay with mobile money"}</h2>
          <label className="block space-y-1 text-sm font-semibold">Mobile money number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" disabled={busy || pending} className="min-h-12 w-full rounded-xl px-3 text-base font-normal" />
            <span className="block text-xs font-normal text-ink-500">{network ? `${mobileMoneyNetworkLabel(network)} detected.` : "Enter your MTN MoMo or Airtel Money number."}{cardAvailable ? " You can choose card on the next screen." : ""}</span>
          </label>
          {quote?.delivery && quote.items && quote.itemsSubtotal != null ? (
            <OrderBreakdown items={quote.items} itemsSubtotal={quote.itemsSubtotal} delivery={quote.delivery} fees={amount != null ? amount - quote.baseAmount : 0} total={amount} />
          ) : (
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{amount == null ? "Loading…" : formatUgx(amount)}</span></div>
          )}
          <p className="rounded-xl bg-gold/10 p-3 text-sm leading-6">Your money is held safely in the app. The rider receives it only after your delivery is completed.</p>
          {pending && <p role="status" className="rounded-xl bg-gold/10 p-3 text-sm">Approve the payment request on your phone. We&apos;re waiting for confirmation. You will not be charged again.</p>}
          {failed && !pending && <p role="status" className="text-sm text-ink-500">Your last payment did not complete. You can try again.</p>}
          <button type="button" onClick={() => void pay()} disabled={payDisabled} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 disabled:opacity-50">
            {busy || pending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Please wait…</> : `Pay${amount == null ? "" : ` ${formatUgx(amount)}`}`}
          </button>
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <section className="space-y-2" aria-label="Updates">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Updates from Peebee</h2>
          {guestAlertsSupported() && alerts !== "on" && (
            <button type="button" onClick={() => void turnOnAlerts()} className="flex min-h-10 items-center gap-1.5 rounded-full border border-gold px-3 text-sm font-semibold"><BellRing className="h-4 w-4 text-gold" aria-hidden /> Turn on alerts</button>
          )}
        </div>
        {alerts === "blocked" && <p className="text-xs text-ink-500">Alerts are blocked in this browser. You will still get updates here and by message.</p>}
        {updates.length === 0 ? <p className="text-sm text-ink-500">Updates about your delivery will appear here.</p> : (
          <ul className="space-y-2">
            {updates.map((m) => (
              <li key={m.id} className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-sm">
                <p>{m.body}</p>
                <p className="mt-1 text-xs text-ink-500">{new Date(m.created_at.replace(" ", "T") + (m.created_at.endsWith("Z") ? "" : "Z")).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user ? (
        <Link href={`/orders/${id}`} className="flex min-h-12 items-center justify-center rounded-full border border-gold px-6 text-sm font-bold">Open in my orders</Link>
      ) : canCreateAccount ? (
        <section className="home-card space-y-3" aria-label="Create an account">
          <h2 className="text-lg font-bold">Create an account to track this order</h2>
          <p className="text-sm text-ink-500">We&apos;ll use the details you gave. Choose a password and you can follow your delivery live.</p>
          <label className="block space-y-1 text-sm font-semibold">Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="min-h-12 w-full rounded-xl px-3 text-base font-normal" />
          </label>
          {accountError && <p role="alert" className="text-sm text-red-700">{accountError}</p>}
          <button type="button" onClick={() => void createAccount()} disabled={accountBusy || password.length < 8} className="flex min-h-12 w-full items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-ink-gold disabled:opacity-50">{accountBusy ? "Creating…" : "Create my account"}</button>
        </section>
      ) : (
        <Link href="/login" className="flex min-h-12 items-center justify-center rounded-full border border-gold px-6 text-sm font-bold">Sign in to track this order</Link>
      )}
    </div>
  );
}
