import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | Peebee",
  description: "Terms of Use for Peebee customers, riders, restaurants, and visitors.",
};

export default function TermsPage() {
  return (
    <div className="plain wrap legal">
<section>
        <p className="kicker">Legal</p>
        <h1 className="display">Terms of Use</h1>
        <p className="quiet">Last updated: September 25, 2026</p>

        <div className="legal-card">
          <section>
            <h2>1. Using Peebee</h2>
            <p>
              Peebee provides technology that helps customers request rides, food delivery, shopping errands, and parcel delivery from independent riders and participating businesses. By using Peebee, you agree to use the platform lawfully, provide accurate information, and follow all applicable rules shown in the app.
            </p>
          </section>

          <section>
            <h2>2. Accounts and eligibility</h2>
            <p>
              You are responsible for the activity on your account and for keeping your login details secure. Riders, restaurants, and staff may be asked to provide verification information before they can access certain features.
            </p>
          </section>

          <section>
            <h2>3. Orders, rides, and deliveries</h2>
            <p>
              Customers are responsible for describing requests clearly and being available for pickup, delivery, substitutions, approvals, and payment confirmation. Riders are responsible for handling accepted jobs with care and communicating status updates through the app.
            </p>
          </section>

          <section>
            <h2>4. Payments</h2>
            <p>
              Peebee may support mobile money, cash, wallet, or other payment methods. Fees, delivery charges, subscriptions, and payment rules may vary by service type and may be shown in the app before or during a transaction.
            </p>
          </section>

          <section>
            <h2>5. Prohibited use</h2>
            <p>
              Do not use Peebee for illegal goods, unsafe deliveries, harassment, fraud, impersonation, platform abuse, or any activity that could harm customers, riders, restaurants, staff, or the public.
            </p>
          </section>

          <section>
            <h2>6. Platform availability</h2>
            <p>
              We work to keep Peebee reliable, but service availability may be affected by network conditions, maintenance, third-party providers, maps, payment services, or operational constraints.
            </p>
          </section>

          <section>
            <h2>7. Changes to these terms</h2>
            <p>
              We may update these Terms of Use as Peebee grows. Updated terms will be posted on this page, and continued use of Peebee means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2>8. Contact</h2>
            <p>
              For questions about these terms, contact Peebee at <a href="mailto:support@peebee.online">support@peebee.online</a> or visit us at Plot 15, Mugula Road, Entebbe.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
