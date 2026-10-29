import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { ACCOUNT_BY_SLUG } from "../lib/account";
import { APP_URL } from "../lib/content";
import { PHOTO_FILES } from "../lib/subs";

/** One of the account pages of the app (wallet, cart, orders…), as a normal page. Nothing on it is a real balance, name or order. */
export function AccountView({ slug }: { slug: string }) {
  const a = ACCOUNT_BY_SLUG[slug];
  const photo = PHOTO_FILES[a.photo];
  return (
    <article className="sp wrap">
      <header className="sp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={photo.alt} style={photo.pos ? { objectPosition: photo.pos } : undefined} />
        <div className="sp-shade" />
        <div className="sp-title">
          <span className="sp-kicker"><a.icon size={16} aria-hidden /> In your account</span>
          <h1>{a.title}</h1>
        </div>
      </header>
      <p className="lead sp-lead">{a.lead}</p>
      <div className="sp-cols">
        <section aria-labelledby="ac-get">
          <h2 id="ac-get">What you find here</h2>
          <ul className="sp-points">
            {a.points.map((p) => (
              <li key={p}><Check size={16} aria-hidden /> <span>{p}</span></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="ac-open">
          <h2 id="ac-open">In the app</h2>
          <p className="sp-cost">This page describes it. Your own {a.title.toLowerCase()} shows once you sign in to Peebee, and this site never shows anyone&apos;s balances, names or orders.</p>
          {a.appPath && (
            <a href={`${APP_URL}${a.appPath}`} className="btn btn-gold sp-open">Open in Peebee <ArrowUpRight size={16} aria-hidden /></a>
          )}
        </section>
      </div>
      <section aria-labelledby="ac-rel">
        <h2 id="ac-rel">Nearby</h2>
        <ul className="sp-rel">
          {a.related.map((r) => (
            <li key={r.href}>
              <Link href={r.href}>
                <span><b>{r.title}</b></span>
                <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
