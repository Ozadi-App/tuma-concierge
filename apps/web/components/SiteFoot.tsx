import Link from "next/link";
import { StoreBadges } from "./StoreBadges";
import { PartnerLink } from "./PartnerLink";
import { Logo } from "./Logo";

export function SiteFoot() {
  return (
    <footer className="foot">
      <div className="foot-top">
        <div className="foot-brand">
          <Link href="/" className="foot-logo" aria-label="Peebee home"><Logo className="foot-mark" /><b>Peebee</b></Link>
          <p>One app and one wallet for everyday Uganda.</p>
          <StoreBadges className="foot-badges" />
        </div>
        <div className="foot-right">
          <nav className="foot-cols" aria-label="Footer">
            <div>
              <p className="foot-h">Company</p>
              <Link href="/about">About us</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/contact">Contact us</Link>
              <Link href="/careers">Work with us</Link>
            </div>
            <div>
              <p className="foot-h">Partners &amp; legal</p>
              <PartnerLink href="/partners">Partner with Peebee</PartnerLink>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <a href="mailto:support@peebee.online" className="foot-mail">support@peebee.online</a>
            </div>
          </nav>
        </div>
      </div>
      <div className="foot-base">
        <span>© {new Date().getFullYear()} Peebee</span>
        <span>Plot 15, Mugula Road, Entebbe</span>
      </div>
    </footer>
  );
}
