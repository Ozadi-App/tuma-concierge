import type { Metadata } from "next";
import { Megaphone, Headphones, Code2, Handshake } from "lucide-react";
import { MailForm } from "../../components/MailForm";

export const metadata: Metadata = { title: "Work with us | Peebee", description: "Join the Peebee team. We are looking for sales agents and more." };

const ROLES = [
  { icon: Megaphone, t: "Sales agents", d: "Introduce Peebee to shops, kitchens, riders, schools and service providers in your area, and help them get set up. This is the role we most need now." },
  { icon: Handshake, t: "Partner onboarding", d: "Walk new partners through verification and their first orders, and stay their first point of contact." },
  { icon: Code2, t: "Product and engineering", d: "Build and improve the Peebee apps and the tools behind them." },
  { icon: Headphones, t: "Customer support", d: "Answer customers and partners by chat and email, and see problems through to a fix." },
];

export default function CareersPage() {
  return (
    <div className="plain wrap ca">
      <p className="kicker">Work with us</p>
      <h1 className="display">Help build Peebee across Uganda.</h1>
      <p className="lead ca-lead">We are growing, and we are looking for people who know their town and like talking to people. Sales agents most of all.</p>

      <div className="ca-grid">
      <section className="ab-sec ca-side" aria-labelledby="ca-roles">
        <h2 id="ca-roles" className="ab-h2">Who we are looking for</h2>
        <ul className="ca-roles">
          {ROLES.map((r) => (
            <li key={r.t}><span className="feat-ic"><r.icon size={20} aria-hidden /></span><b>{r.t}</b><small>{r.d}</small></li>
          ))}
        </ul>
        <p className="quiet">Pay and terms depend on the role and are discussed with you directly.</p>
      </section>

      <section className="ab-sec co-form ca-form" aria-labelledby="ca-apply">
        <h2 id="ca-apply" className="ab-h2">Apply</h2>
        <MailForm to="support@peebee.online" subject="Application: Work with Peebee" cta="Send application" fields={[
          { name: "name", label: "Full name", required: true, autoComplete: "name" },
          { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
          { name: "phone", label: "Phone", type: "tel", required: true, autoComplete: "tel" },
          { name: "role", label: "Role", type: "select", options: ROLES.map((r) => r.t).concat("Something else"), required: true },
          { name: "area", label: "Town or area", required: true },
          { name: "note", label: "A short note about you", type: "textarea", required: true },
        ]} />
      </section>
      </div>
    </div>
  );
}
