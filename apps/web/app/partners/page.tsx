import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Inbox, KeyRound, Wallet, Mail, MapPin } from "lucide-react";
import { PARTNER_DOORS, PARTNER_TYPES } from "../../lib/partners";
import { ModuleShow } from "../../components/ModuleNotice";
import { moduleOfPartner } from "../../lib/module-map";

export const metadata: Metadata = {
  title: "Peebee Partners | Earn with Peebee",
  description: "Ride, sell, cook, teach or work with Peebee. Find the page written for what you do.",
};

const HOW = [
  { icon: BadgeCheck, t: "Apply and get verified", d: "Sign up in the Peebee app made for your kind of work. Peebee checks every partner before the first job reaches them." },
  { icon: Inbox, t: "Work comes to you", d: "Orders, trips and bookings arrive in your app, from customers already using Peebee." },
  { icon: KeyRound, t: "Paid up front, released by PIN", d: "The customer pays before you start and Peebee holds it. When the job is handed over, their PIN releases the money." },
  { icon: Wallet, t: "Your wallet, your mobile money", d: "Earnings land in your Peebee wallet. Each partner page explains how you withdraw to MTN or Airtel Mobile Money." },
];

const QS = [
  { q: "Which page is mine?", a: "Pick the kind of work you do below. A boda rider and a bakery do not work the same way, so each has its own page with its own sign-up steps, rules and pay." },
  { q: "What does Peebee take?", a: "It depends on what you do. Each partner page states the commission or plan that applies to that kind of work." },
  { q: "Do I deal with cash?", a: "Customers pay through Peebee before the job starts, and the money is held until the job is handed over. That escrow is what protects you if a customer disputes." },
  { q: "Who do I talk to?", a: "Write to support@peebee.online and a person on the team will reply." },
];

export default function Partners() {
  return (
    <div className="pl">
      <section className="pl-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/sub-boda.webp" alt="" className="pl-hero-img" />
        <span className="pl-hero-shade" />
        <div className="pp-wrap pl-hero-in">
          <p className="pl-kicker">Peebee Partners</p>
          <h1 className="pl-h1">Earn with Peebee.</h1>
          <p className="pl-lead">Ride, sell, cook, teach or take on jobs near home. Customers pay up front, Peebee holds it safely, and your earnings go to your wallet.</p>
          <div className="pl-ctas">
            <a href="#ways" className="pl-btn pl-btn-gold">Find your way to earn <ArrowRight size={17} aria-hidden /></a>
            <a href="#how" className="pl-btn pl-btn-ghost">How it works</a>
          </div>
        </div>
      </section>

      <section id="ways" className="pp-wrap pl-sec">
        <p className="pl-eyebrow">Ways to earn</p>
        <h2 className="pl-h2">Choose what you do.</h2>
        {PARTNER_DOORS.map((d) => (
          <div key={d.id} id={d.id} className="pl-door" data-door={d.id}>
            <div className="pl-door-head"><h3>{d.title}</h3><p>{d.line}</p></div>
            <ul className="pl-types">
              {PARTNER_TYPES.filter((p) => p.door === d.id).map((p) => (
                <ModuleShow key={p.slug} module={moduleOfPartner(p.slug, p.door)}><li>
                  <Link href={`/partners/${p.slug}`} className="pl-type" data-closed={p.closed || undefined}>
                    <span className="pl-type-ic"><p.icon size={19} aria-hidden /></span>
                    <span className="pl-type-t"><b>{p.name}</b><small>{p.closed ? "Not open yet" : p.who}</small></span>
                    <ArrowRight size={16} className="pl-type-arrow" aria-hidden />
                  </Link>
                </li></ModuleShow>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section id="how" className="pl-band">
        <div className="pp-wrap pl-sec">
          <p className="pl-eyebrow">How it works</p>
          <h2 className="pl-h2">The same promise, whatever you do.</h2>
          <ol className="pl-how">
            {HOW.map((h, i) => (<li key={h.t}><span className="pl-num">{String(i + 1).padStart(2, "0")}</span><h.icon size={22} aria-hidden /><b>{h.t}</b><p>{h.d}</p></li>))}
          </ol>
        </div>
      </section>

      <section id="questions" className="pp-wrap pl-sec">
        <p className="pl-eyebrow">Questions</p>
        <h2 className="pl-h2">Before you start.</h2>
        <div className="pl-qs">
          {QS.map((q) => (<details key={q.q}><summary>{q.q}</summary><p>{q.a}</p></details>))}
        </div>
      </section>

      <section id="contact" className="pp-wrap pl-sec pl-contact">
        <div>
          <p className="pl-eyebrow">Contact</p>
          <h2 className="pl-h2">Talk to the partner team.</h2>
        </div>
        <ul>
          <li><Mail size={19} aria-hidden /><a href="mailto:support@peebee.online">support@peebee.online</a></li>
          <li><MapPin size={19} aria-hidden /><span>Plot 15, Mugula Road, Entebbe</span></li>
        </ul>
      </section>
    </div>
  );
}
