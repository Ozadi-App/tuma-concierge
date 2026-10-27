"use client";

import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getToken, portalFetch, PortalError, setToken, type PortalConfig, type PortalMe } from "../../../lib/portal";

const MERCHANT_APP_URL = "https://merchant.peebee.online";

const STATUS_TEXT: Record<string, string> = {
  pending_approval: "Waiting for approval",
  provisional: "Approved with limits",
  active: "Approved",
  suspended: "Suspended",
  rejected: "Not approved",
};

function Tick({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden /> : <Circle className="h-4 w-4 text-ink-500" aria-hidden />}
      <span className={done ? "text-ink" : "text-ink-500"}>{children}</span>
    </li>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [kyc, setKyc] = useState({ registrationNumber: "", taxId: "", declared: false });
  const [newStore, setNewStore] = useState({ name: "", category: "stores", appListing: true, webStore: false });

  const load = useCallback(async () => {
    if (!getToken()) { router.replace("/portal/login"); return; }
    try {
      setMe(await portalFetch<PortalMe>("/merchant-portal/me"));
      setConfig(await portalFetch<PortalConfig>("/public/merchant-portal/config", { auth: false }));
    } catch (e) {
      const err = e as PortalError;
      if (err.status === 401) { setToken(null); router.replace("/portal/login"); return; }
      setError(err.message);
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<void>, done?: string) {
    setBusy(true); setError(""); setNote("");
    try { await fn(); if (done) setNote(done); await load(); } catch (e) { setError((e as PortalError).message); } finally { setBusy(false); }
  }

  const toggle = (key: "appListing" | "webStore", value: boolean) =>
    act(() => portalFetch("/merchant-portal/features", { method: "PATCH", body: { [key]: value } }).then(() => undefined), "Saved.");

  const submitKyc = () => act(async () => {
    await portalFetch(`/merchants/${me!.merchant!.id}/kyc`, { method: "POST", body: { registrationNumber: kyc.registrationNumber, taxId: kyc.taxId, declarationAccepted: true } });
  }, "Details saved.");

  const upload = (type: "owner-id" | "business-registration", file: File | undefined) => {
    if (!file) return;
    return act(async () => {
      const form = new FormData();
      form.append("file", file);
      await portalFetch(`/merchants/${me!.merchant!.id}/kyc-documents/${type}`, { method: "POST", form });
    }, "Document uploaded.");
  };

  const addStore = () => act(async () => {
    await portalFetch("/merchant-portal/features", {
      method: "PATCH",
      body: { appListing: newStore.appListing, webStore: newStore.webStore, store: { name: newStore.name, category: newStore.category } },
    });
  }, "Your store is set up.");

  if (loading) return <p className="pt-10 text-sm font-bold text-ink-500">Loading your dashboard…</p>;

  if (!me?.merchant) {
    return (
      <div className="card mx-auto mt-8 max-w-md space-y-3">
        <h1 className="text-2xl font-black text-ink">No business yet</h1>
        <p className="text-sm text-ink-500">This account doesn&apos;t have a merchant business. Register one to get started.</p>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <Link href="/portal/register" className="button button-primary">Register your business</Link>
      </div>
    );
  }

  const m = me.merchant;
  const docs = me.documents;
  const offered = me.offered ?? config?.features ?? [];
  const store = me.store;
  const needsDetails = docs && !(docs.registrationNumber && docs.taxId);

  return (
    <div className="space-y-6 pt-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">{m.displayName}</h1>
          <p className="text-sm text-ink-500">Status: <strong className="text-ink">{STATUS_TEXT[m.status] ?? m.status}</strong></p>
        </div>
        <button type="button" onClick={() => { setToken(null); router.push("/portal"); }} className="button button-ghost">Sign out</button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {note && <p role="status" className="rounded-xl bg-[rgb(var(--surface-card))] p-3 text-sm font-bold text-ink">{note}</p>}

      {me.nextSteps.length > 0 && (
        <section className="card space-y-2" aria-label="What happens next">
          <h2 className="text-base font-black text-ink">What happens next</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-500">{me.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      )}

      <section className="card space-y-4" aria-label="Verification">
        <h2 className="text-base font-black text-ink">Verify your business</h2>
        {docs && (
          <ul className="grid gap-2 sm:grid-cols-2">
            <Tick done={docs.registrationNumber}>Registration number</Tick>
            <Tick done={docs.taxId}>Tax ID</Tick>
            <Tick done={docs.ownerId}>Owner ID document</Tick>
            <Tick done={docs.businessRegistration}>Business registration document</Tick>
          </ul>
        )}
        {needsDetails && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submitKyc(); }}>
            <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Business registration number</span>
              <input required minLength={3} value={kyc.registrationNumber} onChange={(e) => setKyc({ ...kyc, registrationNumber: e.target.value })} className="w-full rounded-xl p-3" /></label>
            <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Tax ID (TIN)</span>
              <input required minLength={3} value={kyc.taxId} onChange={(e) => setKyc({ ...kyc, taxId: e.target.value })} className="w-full rounded-xl p-3" /></label>
            <label className="flex items-start gap-2 text-sm text-ink-500"><input type="checkbox" required checked={kyc.declared} onChange={(e) => setKyc({ ...kyc, declared: e.target.checked })} className="mt-1" /> I confirm these details are true and I own or manage this business.</label>
            <button disabled={busy || !kyc.declared} className="button button-primary disabled:opacity-50">Save details</button>
          </form>
        )}
        {docs && (!docs.ownerId || !docs.businessRegistration) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {!docs.ownerId && (
              <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Owner ID (photo or PDF)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(e) => void upload("owner-id", e.target.files?.[0])} className="w-full text-xs" /></label>
            )}
            {!docs.businessRegistration && (
              <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Business registration (photo or PDF)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(e) => void upload("business-registration", e.target.files?.[0])} className="w-full text-xs" /></label>
            )}
          </div>
        )}
        <p className="text-xs text-ink-500">Files up to 8 MB. We only use them to check your business.</p>
      </section>

      <section className="card space-y-4" aria-label="Your options">
        <h2 className="text-base font-black text-ink">Your options</h2>
        {store ? (
          <>
            <p className="text-sm text-ink-500">Store: <strong className="text-ink">{store.name}</strong> — {store.status === "active" ? "live" : store.status === "draft" ? "waiting to go live" : store.status}</p>
            {offered.includes("app_listing") || store.listedInApp ? (
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={store.listedInApp} disabled={busy || (!store.listedInApp && !offered.includes("app_listing"))} onChange={(e) => void toggle("appListing", e.target.checked)} className="mt-1" />
                <span><strong className="block text-ink">Listed in the Peebee app</strong><span className="text-xs text-ink-500">Shoppers can find and order from your store in the app.</span></span>
              </label>
            ) : null}
            {offered.includes("web_store") || store.webStoreEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={store.webStoreEnabled} disabled={busy || (!store.webStoreEnabled && !offered.includes("web_store"))} onChange={(e) => void toggle("webStore", e.target.checked)} className="mt-1" />
                <span><strong className="block text-ink">Web store</strong><span className="text-xs text-ink-500">Your own web address that takes orders.</span></span>
              </label>
            ) : null}
            {store.webStoreEnabled && (
              <a href={store.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-gold">{store.url.replace("https://", "")} <ExternalLink className="h-4 w-4" aria-hidden /></a>
            )}
            <p className="text-xs text-ink-500">Add and edit products, offers and your store&apos;s look in the <a className="font-bold text-gold" href={MERCHANT_APP_URL}>Peebee merchant app</a>. Changes show on the app and the web store.</p>
          </>
        ) : offered.length > 0 ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void addStore(); }}>
            <p className="text-sm text-ink-500">You have a merchant account. Add a store to sell products.</p>
            <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">Store name</span>
              <input required minLength={2} value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} className="w-full rounded-xl p-3" /></label>
            <label className="block space-y-1.5 text-sm"><span className="font-bold text-ink">What does it sell?</span>
              <select value={newStore.category} onChange={(e) => setNewStore({ ...newStore, category: e.target.value })} className="w-full rounded-xl p-3">
                {(config?.storeCategories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            {offered.includes("app_listing") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newStore.appListing} onChange={(e) => setNewStore({ ...newStore, appListing: e.target.checked })} /> List in the Peebee app</label>}
            {offered.includes("web_store") && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newStore.webStore} onChange={(e) => setNewStore({ ...newStore, webStore: e.target.checked })} /> Give me a web store</label>}
            <button disabled={busy || (!newStore.appListing && !newStore.webStore)} className="button button-primary disabled:opacity-50">Set up my store</button>
          </form>
        ) : <p className="text-sm text-ink-500">Your merchant account is ready. Stores aren&apos;t offered on the website right now.</p>}
      </section>
    </div>
  );
}
