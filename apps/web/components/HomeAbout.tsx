import Link from "next/link";
import { ArrowRight } from "lucide-react";


/** A short "what is Peebee" block on the home, leading to /about. */
export function HomeAbout({ desk = false }: { desk?: boolean }) {
  return (
    <section className={`ha${desk ? " ha-desk" : ""}`} aria-labelledby="ha-h">
      <div className="ha-in">
        <div className="ha-copy">
          <p className="ha-kicker">About Peebee</p>
          <h2 id="ha-h" className="ha-h">One app for everyday Uganda.</h2>
          <p className="ha-p">Peebee is a Ugandan app that brings your everyday errands into one account and one wallet, with every payment held in escrow until the job is done.</p>
          <Link href="/about" className="ha-btn">Learn more about us <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}
