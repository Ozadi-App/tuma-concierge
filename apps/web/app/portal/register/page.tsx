"use client";

import { CheckCircle2, Globe, LocateFixed, Smartphone, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, portalFetch, PortalError, setToken, type PortalConfig } from "../../../lib/portal";

const STEPS = ["Account", "Business", "Options", "Review"] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [step, setStep] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [account, setAccount] = useState({ name: "", phone: "", email: "", password: "" });
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [proof, setProof] = useState("");
  const [codeNote, setCodeNote] = useState("");

  const [biz, setBiz] = useState({ legalName: "", displayName: "", categoryId: "", outletName: "", phone: "", address: "" });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [features, setFeatures] = useState({ appListing: false, webStore: false });
  const [store, setStore] = useState({ name: "", category: "stores", description: "" });
  const [nameCheck, setNameCheck] = useState<{ ok: boolean; message: string; addressPreview?: string } | null>(null);

  useEffect(() => {
    portalFetch<PortalConfig>("/public/merchant-portal/config", { auth: false })
      .then((c) => {
        setConfig(c);
        setBiz((b) => ({ ...b, categoryId: b.categoryId || c.categories[0]?.id || "" }));
        setFeatures({ appListing: c.features.includes("app_listing"), webStore: c.features.includes("web_store") });
      })
      .catch((e) => setError(e.message));
    if (getToken()) { setSignedIn(true); setStep(1); }
  }, []);

  const wantsStore = features.appListing || features.webStore;

  useEffect(() => {
    if (!wantsStore || store.name.trim().length < 2) { setNameCheck(null); return; }
    const t = setTimeout(() => {
      portalFetch<{ ok: boolean; message: string; addressPreview?: string }>(`/public/merchant-portal/name-check?name=${encodeURIComponent(store.name)}`, { auth: false })
        .then(setNameCheck).catch(() => setNameCheck(null));
    }, 400);
    return () => clearTimeout(t);
  }, [store.name, wantsStore]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) {
      const err = e as PortalError;
      if (err.code === "already_a_merchant") { router.push("/portal/dashboard"); return; }
      setError(err.message);
    } finally { setBusy(false); }
  }

  const sendCode = () => run(async () => {
    const r = await portalFetch<{ challenge: string }>("/public/phone-proof/request", { method: "POST", auth: false, body: { phone: account.phone, purpose: "merchant_portal" } });
    setChallenge(r.challenge); setCodeNote("We texted you a 6-digit code.");
  });
  const confirmCode = () => run(async () => {
    const r = await portalFetch<{ proof: string }>("/public/phone-proof/verify", { method: "POST", auth: false, body: { challenge, code: code.trim() } });
    setProof(r.proof); setCodeNote("Phone confirmed.");
  });

  const createAccount = () => run(async () => {
    const r = await portalFetch<{ token: string }>("/public/merchant-portal/register", {
      method: "POST", auth: false, headers: proof ? { "x-phone-proof": proof } : {},
      body: { name: account.name, phone: account.phone, email: account.email || undefined, password: account.password },
    });
    setToken(r.token); setSignedIn(true); setStep(1);
  });

  function captureLocation() {
    if (!navigator.geolocation) return setError("This browser can't share a location. You can add it later in the Peebee merchant app.");
    navigator.geolocation.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("We couldn't get your location. You can add it later in the Peebee merchant app."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const submit = () => run(async () => {
    await portalFetch("/merchant-portal/apply", {
      method: "POST",
      body: {
        legalName: biz.legalName, displayName: biz.displayName, categoryId: biz.categoryId, outletName: biz.outletName,
        phone: biz.phone || undefined, address: biz.address || undefined, ...(location ?? {}),
        features,
        ...(wantsStore ? { store: { name: store.name, category: store.category, description: store.description || undefined, phone: biz.phone || undefined, address: biz.address || undefined } } : {}),
      },
    });
    router.push("/portal/dashboard");
  });

  if (config && !config.enabled) return <p className="pt-10 text-sm font-bold text-ink-500">Sign-up on the website is paused for now. Please check back soon.</p>;

  const accountReady = account.name.trim() && account.phone.trim().length >= 6 && account.password.length >= 6 && (!config?.phoneCodeRequired || proof);
  const bizReady = biz.legalName.trim().length >= 2 && biz.displayName.trim().length >= 2 && biz.outletName.trim().length >= 2 && biz.categoryId;
  const storeReady = !wantsStore || (store.name.trim().length >= 2 && nameCheck?.ok !== false);
  const offered = (id: string) => config?.features.includes(id);

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-8">
      <ol className="flex gap-2 text-xs font-black" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-full border px-3 py-1.5 text-center ${i === step ? "border-gold bg-gold/15 text-ink" : i < step ? "border-gold/40 text-ink-500" : "border-[var(--border-faint)] text-ink-500"}`}>{s}</li>
        ))}
      </ol>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {step === 0 && (
        <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); void createAccount(); }}>
          <h1 className="text-2xl font-black text-ink">Create your account</h1>
          <p className="text-sm text-ink-500">This is your Peebee account. It works in the Peebee app and the merchant app too.</p>
          {config?.accountCreation === "sign_in_only" ? (
            <p className="text-sm font-bold text-ink-500">New accounts can&apos;t be made here. <Link href="/portal/login" className="text-gold underline">Sign in with your Peebee account</Link> to continue.</p>
          ) : (
            <>
              <Field label="Your full name"><input required autoComplete="name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} className="w-full rounded-xl p-3" /></Field>
              <Field label="Phone number" hint="MTN or Airtel, e.g. 0772 123 456"><input required inputMode="tel" autoComplete="tel" value={account.phone} onChange={(e) => { setAccount({ ...account, phone: e.target.value }); setProof(""); }} className="w-full rounded-xl p-3" /></Field>
              {config?.phoneCodeRequired && (
                <div className="space-y-2 rounded-xl border border-[var(--border-faint)] p-3">
                  {proof ? <p className="flex items-center gap-2 text-sm font-bold text-ink"><CheckCircle2 className="h-4 w-4 text-gold" aria-hidden /> Phone confirmed</p> : (
                    <>
                      <button type="button" disabled={busy || account.phone.trim().length < 6} onClick={() => void sendCode()} className="button button-ghost">Text me a code</button>
                      {challenge && (
                        <div className="flex gap-2">
                          <input inputMode="numeric" maxLength={6} aria-label="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-xl p-3" />
                          <button type="button" disabled={busy || code.trim().length !== 6} onClick={() => void confirmCode()} className="button button-light">Confirm</button>
                        </div>
                      )}
                    </>
                  )}
                  {codeNote && <p className="text-xs text-ink-500">{codeNote}</p>}
                </div>
              )}
              <Field label="Email (optional)"><input type="email" autoComplete="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="w-full rounded-xl p-3" /></Field>
              <Field label="Password" hint="At least 6 characters"><input required type="password" autoComplete="new-password" minLength={6} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} className="w-full rounded-xl p-3" /></Field>
              <button disabled={busy || !accountReady} className="button button-primary w-full disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
            </>
          )}
          <p className="text-center text-sm text-ink-500">Already have a Peebee account? <Link href="/portal/login" className="font-bold text-gold">Sign in</Link></p>
        </form>
      )}

      {step === 1 && (
        <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); setStep(2); setError(""); }}>
          <h1 className="text-2xl font-black text-ink">About your business</h1>
          <Field label="Registered legal name"><input required value={biz.legalName} onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} className="w-full rounded-xl p-3" /></Field>
          <Field label="Trading name customers know" hint="Shown to customers"><input required value={biz.displayName} onChange={(e) => setBiz({ ...biz, displayName: e.target.value })} className="w-full rounded-xl p-3" /></Field>
          <Field label="Business category">
            <select required value={biz.categoryId} onChange={(e) => setBiz({ ...biz, categoryId: e.target.value })} className="w-full rounded-xl p-3">
              {config?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="First outlet name" hint="Your shop or branch, e.g. Main shop"><input required value={biz.outletName} onChange={(e) => setBiz({ ...biz, outletName: e.target.value })} className="w-full rounded-xl p-3" /></Field>
          <Field label="Business phone"><input inputMode="tel" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} className="w-full rounded-xl p-3" /></Field>
          <Field label="Outlet address"><input value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} className="w-full rounded-xl p-3" /></Field>
          <div className="space-y-1">
            <button type="button" onClick={captureLocation} className="button button-ghost"><LocateFixed className="h-4 w-4" aria-hidden /> {location ? "Location saved" : "Use my current location"}</button>
            <p className="text-xs text-ink-500">Optional. It helps protect in-store payments. You can add it later in the merchant app.</p>
          </div>
          <button disabled={!bizReady} className="button button-primary w-full disabled:opacity-50">Continue</button>
        </form>
      )}

      {step === 2 && (
        <form className="card space-y-4" onSubmit={(e) => { e.preventDefault(); setStep(3); setError(""); }}>
          <h1 className="text-2xl font-black text-ink">Choose your options</h1>
          <p className="text-sm text-ink-500">Everyone gets a merchant account. Switch on more if you want it. You can change this later.</p>
          <div className="space-y-3">
            <div className="flex gap-3 rounded-xl border border-gold bg-gold/10 p-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
              <div><p className="text-sm font-black text-ink">Merchant account</p><p className="text-xs text-ink-500">Take payments in your shop. Always included.</p></div>
            </div>
            {offered("app_listing") && (
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${features.appListing ? "border-gold bg-gold/10" : "border-[var(--border-faint)]"}`}>
                <input type="checkbox" checked={features.appListing} onChange={(e) => setFeatures({ ...features, appListing: e.target.checked })} className="mt-1" />
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
                <div><p className="text-sm font-black text-ink">List my products in the Peebee app</p><p className="text-xs text-ink-500">Shoppers find your store in the app, order, and a rider delivers.</p></div>
              </label>
            )}
            {offered("web_store") && (
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${features.webStore ? "border-gold bg-gold/10" : "border-[var(--border-faint)]"}`}>
                <input type="checkbox" checked={features.webStore} onChange={(e) => setFeatures({ ...features, webStore: e.target.checked })} className="mt-1" />
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
                <div><p className="text-sm font-black text-ink">Give me a web store</p><p className="text-xs text-ink-500">Your own address, like yourshop.{config?.webDomain ?? "peebee.online"}.</p></div>
              </label>
            )}
          </div>
          {wantsStore && (
            <div className="space-y-4 border-t border-[var(--border-faint)] pt-4">
              <h2 className="text-base font-black text-ink">Your store</h2>
              <Field label="Store name" hint={nameCheck?.message}>
                <input required value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} className="w-full rounded-xl p-3" />
              </Field>
              {nameCheck?.ok && features.webStore && <p className="text-xs font-bold text-ink">Your web address will look like {nameCheck.addressPreview}</p>}
              {nameCheck && !nameCheck.ok && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-300">{nameCheck.message}</p>}
              <Field label="What does it sell?">
                <select value={store.category} onChange={(e) => setStore({ ...store, category: e.target.value })} className="w-full rounded-xl p-3">
                  {config?.storeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Short description (optional)"><textarea rows={3} maxLength={500} value={store.description} onChange={(e) => setStore({ ...store, description: e.target.value })} className="w-full rounded-xl p-3" /></Field>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="button button-ghost">Back</button>
            <button disabled={!storeReady} className="button button-primary flex-1 disabled:opacity-50">Continue</button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h1 className="text-2xl font-black text-ink">Check and submit</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ink-500">Business</dt><dd className="text-right font-bold text-ink">{biz.displayName} ({biz.legalName})</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-500">Outlet</dt><dd className="text-right font-bold text-ink">{biz.outletName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-500">Merchant account</dt><dd className="font-bold text-ink">Yes</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-500">Listed in the Peebee app</dt><dd className="font-bold text-ink">{features.appListing ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-500">Web store</dt><dd className="font-bold text-ink">{features.webStore ? "Yes" : "No"}</dd></div>
            {wantsStore && <div className="flex justify-between gap-4"><dt className="text-ink-500">Store name</dt><dd className="font-bold text-ink">{store.name}</dd></div>}
          </dl>
          <p className="text-xs text-ink-500">Next you&apos;ll add your registration details and documents so we can approve your business. Your store goes live once you&apos;re approved.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="button button-ghost">Back</button>
            <button type="button" disabled={busy} onClick={() => void submit()} className="button button-primary flex-1 disabled:opacity-50">{busy ? "Submitting…" : "Submit my application"}</button>
          </div>
        </div>
      )}
      {signedIn && step > 0 && <p className="text-center text-xs text-ink-500">Signed in. <button type="button" className="underline" onClick={() => { setToken(null); setSignedIn(false); setStep(0); }}>Use another account</button></p>}
    </div>
  );
}
