"use client";

import { ArrowRight, Globe, Smartphone, Store, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { portalFetch, type PortalConfig } from "../../lib/portal";

const CHOICES = [
  { id: "merchant", icon: Wallet, title: "Merchant account", body: "Take payments from customers in your shop with Peebee. Every business starts here.", always: true },
  { id: "app_listing", icon: Smartphone, title: "List products in the Peebee app", body: "Shoppers browse your store inside the Peebee app, order, and a rider delivers." },
  { id: "web_store", icon: Globe, title: "A web store of your own", body: "Your own address, like yourshop.peebee.online, with your products, offers and branding." },
];

export default function PortalHome() {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { portalFetch<PortalConfig>("/public/merchant-portal/config", { auth: false }).then(setConfig).catch(() => setFailed(true)); }, []);

  const offered = (id: string, always?: boolean) => always || config?.features.includes(id);
  const closed = config && !config.enabled;

  return (
    <div className="space-y-10 pt-8">
      <section className="max-w-2xl">
        <span className="eyebrow">For businesses</span>
        <h1 className="mt-3 text-4xl font-black leading-tight text-ink sm:text-5xl">Sell on Peebee, your way.</h1>
        <p className="mt-4 text-base leading-7 text-ink-500">
          Register your business once, here on the web. Choose what you want to switch on — you can change it any time. Everything stays in step with the Peebee merchant app, so you never enter anything twice.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {closed ? <p className="rounded-xl bg-[rgb(var(--surface-card))] p-4 text-sm font-bold text-ink-500">Sign-up on the website is paused for now. Please check back soon.</p> : (
            <>
              <Link href="/portal/register" className="button button-primary">Register your business <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href="/portal/dashboard" className="button button-ghost">I already registered</Link>
            </>
          )}
        </div>
        {failed && <p className="mt-3 text-sm text-ink-500">We couldn&apos;t load the latest options. You can still try to register.</p>}
      </section>

      <section aria-labelledby="choices" className="space-y-4">
        <h2 id="choices" className="text-xl font-black text-ink">Choose what you need</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CHOICES.filter((c) => offered(c.id, c.always)).map(({ id, icon: Icon, title, body }) => (
            <div key={id} className="card">
              <Icon className="h-6 w-6 text-gold" aria-hidden />
              <h3 className="mt-3 text-base font-black text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="text-xl font-black text-ink">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {["Create your account", "Tell us about your business", "Choose your options", "Add your documents and we approve you"].map((step, i) => (
            <li key={step} className="card">
              <span className="text-xs font-black text-gold">Step {i + 1}</span>
              <p className="mt-2 text-sm font-bold text-ink">{step}</p>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-sm text-ink-500"><Store className="h-4 w-4" aria-hidden /> Your store goes live once we have checked your business.</p>
      </section>
    </div>
  );
}
