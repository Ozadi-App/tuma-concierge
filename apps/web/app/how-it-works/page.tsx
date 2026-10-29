import type { Metadata } from "next";
import Link from "next/link";
import { Download, UserPlus, LayoutGrid, Send, Wallet, MapPin, Star, ArrowRight } from "lucide-react";
import { APP_URL } from "../../lib/content";
import { StoreBadges } from "../../components/StoreBadges";

export const metadata: Metadata = { title: "How it works | Peebee", description: "From download to done: how Peebee works." };

const STEPS = [
  { icon: Download, t: "Get the app", d: "Open Peebee in your phone's browser and add it to your home screen. Store versions for Android and iPhone are on the way." },
  { icon: UserPlus, t: "Sign up", d: "Create one account with your phone number. The same account works for every module." },
  { icon: LayoutGrid, t: "Choose a module", d: "Ride, Buy, Eat, Learn or Work. Each one opens its own services, from a boda to a cleaner." },
  { icon: Send, t: "Request a service", d: "Say what you need, where and when. You see the price before you confirm, and a verified partner takes the job." },
  { icon: Wallet, t: "Pay with your wallet", d: "Top up from MTN MoMo or Airtel Money. What the job costs is held in escrow, not spent, until it is done." },
  { icon: MapPin, t: "Track it", d: "Follow your rider, order or booking live, and chat with the person doing the job." },
  { icon: Star, t: "Confirm and rate", d: "Hand over your four-digit PIN when you are happy, which releases the payment, then rate the job." },
];

export default function HowItWorksPage() {
  return (
    <div className="plain wrap ab">
      <p className="kicker">How it works</p>
      <h1 className="display">From download to done.</h1>
      <p className="lead ab-lead">Every Peebee service follows the same few steps, whether it is a ride, groceries, dinner, a class or a repair.</p>
      <ol className="hw-steps">
        {STEPS.map((s) => (<li key={s.t}><span className="feat-ic"><s.icon size={20} aria-hidden /></span><b>{s.t}</b><small>{s.d}</small></li>))}
      </ol>
      <div className="ab-ctas" style={{ marginTop: 28 }}>
        <a href={APP_URL} className="btn btn-gold">Download the app <Download size={16} aria-hidden /></a>
        <Link href="/contact" className="btn btn-quiet">Contact us <ArrowRight size={16} aria-hidden /></Link>
      </div>
      <StoreBadges className="hw-badges" />
    </div>
  );
}
