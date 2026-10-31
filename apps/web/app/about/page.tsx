import type { Metadata } from "next";
import Link from "next/link";
import { APP_URL } from "../../lib/content";
import { ModuleShow } from "../../components/ModuleNotice";
import { moduleOfHref } from "../../lib/module-map";
import { ArrowRight, ArrowUpRight, Bike, ShoppingBag, UtensilsCrossed, GraduationCap, Wrench, KeyRound, ShieldCheck, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "About us | Peebee", description: "What Peebee is, and why it is built for Uganda." };

const MODULES = [
  { icon: Bike, t: "Ride", d: "Boda, cars, taxis, VIP, moving and ambulance, from verified riders and drivers.", href: "/ride" },
  { icon: ShoppingBag, t: "Buy", d: "Send a list to the market, order from stores and groceries, or fill a prescription.", href: "/buy" },
  { icon: UtensilsCrossed, t: "Eat", d: "Restaurants, home kitchens, street food, juices and bakeries, delivered.", href: "/eat" },
  { icon: GraduationCap, t: "Learn", d: "Classes and courses from early years to university and work skills, live or in your own time.", href: "/learn" },
  { icon: Wrench, t: "Work", d: "Cleaning, laundry, repairs and skilled workers, booked and paid in one place.", href: "/work" },
];

export default function AboutPage() {
  return (
    <div className="plain wrap ab">
      <p className="kicker">About us</p>
      <h1 className="display">One app for the things a day needs.</h1>
      <p className="lead ab-lead">Peebee puts rides, shopping, food, learning and home services under one account and one wallet. You ask for something, a verified person takes it on, and the money waits safely until the job is done.</p>

      <section className="ab-sec" aria-labelledby="ab-mod">
        <h2 id="ab-mod" className="ab-h2">Five modules</h2>
        <ul className="ab-mods">
          {MODULES.map((m) => (
            <ModuleShow key={m.t} module={moduleOfHref(m.href)}><li><Link href={m.href}><span className="feat-ic"><m.icon size={20} aria-hidden /></span><span><b>{m.t}</b><small>{m.d}</small></span><ArrowRight size={16} aria-hidden /></Link></li></ModuleShow>
          ))}
        </ul>
      </section>

      <section className="ab-sec" aria-labelledby="ab-how">
        <h2 id="ab-how" className="ab-h2">How it works, every time</h2>
        <ul className="ab-trust">
          <li><Wallet size={20} aria-hidden /><span><b>One wallet</b>Top up from MTN MoMo or Airtel Money and pay from the balance.</span></li>
          <li><ShieldCheck size={20} aria-hidden /><span><b>Escrow</b>What a job costs is held, not spent, until the work is done.</span></li>
          <li><KeyRound size={20} aria-hidden /><span><b>A four-digit PIN</b>You hand over your PIN when you are happy, and only then is anyone paid.</span></li>
        </ul>
      </section>

      <section className="ab-sec" aria-labelledby="ab-why">
        <h2 id="ab-why" className="ab-h2">Our mission for Uganda</h2>
        <p className="ab-p">We want everyday services in Uganda to be easy to find, fair to pay for and safe to trust, for the people who use them and for the riders, shops, kitchens, teachers and workers who provide them. That means verified partners, clear prices before you pay, and money that only moves when the job is done.</p>
        <div className="ab-ctas">
          <a href={APP_URL} className="btn btn-gold">Download the app <ArrowUpRight size={16} aria-hidden /></a>
          <Link href="/contact" className="btn btn-quiet">Contact us</Link>
        </div>
      </section>
    </div>
  );
}
