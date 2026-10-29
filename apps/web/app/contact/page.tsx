import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { MailForm } from "../../components/MailForm";

export const metadata: Metadata = { title: "Contact us | Peebee", description: "Write to Peebee support, or find us in Entebbe." };

export default function ContactPage() {
  return (
    <div className="plain wrap co">
      <p className="kicker">Contact us</p>
      <h1 className="display">Talk to Peebee.</h1>
      <p className="lead co-lead">A question about an order, a payment, or joining as a partner? Write to us and a person on the support team will reply by email.</p>
      <div className="co-grid">
        <ul className="co-cards">
          <li><span className="feat-ic"><Mail size={20} aria-hidden /></span><span><b>Email</b><a href="mailto:support@peebee.online">support@peebee.online</a></span></li>
          <li><span className="feat-ic"><MapPin size={20} aria-hidden /></span><span><b>Office</b><span>Plot 15, Mugula Road, Entebbe</span></span></li>
        </ul>
        <section className="co-form" aria-labelledby="co-form-h">
          <h2 id="co-form-h" className="co-h2">Send a message</h2>
          <MailForm to="support@peebee.online" subject="Message from peebee.online" cta="Send message" fields={[
            { name: "name", label: "Your name", required: true, autoComplete: "name" },
            { name: "email", label: "Your email", type: "email", required: true, autoComplete: "email" },
            { name: "topic", label: "About", type: "select", options: ["An order or a trip", "Wallet or a payment", "Becoming a partner", "Something else"], required: true },
            { name: "message", label: "Message", type: "textarea", required: true },
          ]} />
        </section>
      </div>
    </div>
  );
}
