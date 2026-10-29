import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { PartnerQuestions } from "./PartnerQuestions";
import { PARTNER_QUESTIONS } from "../lib/partner-questions";
import { PARTNER_DOORS, PARTNER_TYPES, PARTNER_TYPE_BY_SLUG, type PartnerType } from "../lib/partners";

/**
 * One partner type, one page. Phone: app-style column. Desktop (>=1100px): landing-style spread.
 * Each page gets its own layout variant (cards / timeline / split) plus a door accent.
 */
const VARIANTS = ["cards", "timeline", "split"] as const;

export function PartnerTypePage({ p }: { p: PartnerType }) {
  const door = PARTNER_DOORS.find((d) => d.id === p.door);
  const related = p.related.map((s) => PARTNER_TYPE_BY_SLUG[s]).filter(Boolean);
  const idx = PARTNER_TYPES.findIndex((x) => x.slug === p.slug);
  const variant = VARIANTS[idx % 3];
  const questions = PARTNER_QUESTIONS[p.slug] ?? p.faqs;
  const [first, ...rest] = p.sections;
  const pay = rest.find((s) => s.id === "pay");
  const others = rest.filter((s) => s !== pay);

  return (
    <article className="pt" data-door={p.door} data-variant={variant}>
      <header className="pt-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pt-hero-img" src={p.photo} alt="" />
        <span className="pt-hero-shade" />
        <div className="pt-wrap pt-hero-in">
          <Link href={`/partners#${p.door}`} className="pt-back"><ArrowLeft size={15} aria-hidden /> {door?.title} partners</Link>
          <p className="pt-kicker"><span className="pt-kicker-ic"><p.icon size={14} aria-hidden /></span>{p.name}</p>
          <h1 className="pt-h1">{p.headline}</h1>
          <p className="pt-lead">{p.lead}</p>
          {p.closed ? (
            <p className="pt-closed">Not open yet. There is nothing to sign up for today.</p>
          ) : p.app && (
            <div className="pt-cta"><a href={p.app.url} className="btn btn-gold">Open {p.app.name} <ArrowUpRight size={16} aria-hidden /></a></div>
          )}
        </div>
      </header>

      {p.figures && (
        <section className="pt-strip" aria-label="Starting values">
          <div className="pt-wrap">
            <dl>
              {p.figures.map((f) => (
                <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd>{f.note && <small>{f.note}</small>}</div>
              ))}
            </dl>
            <p className="pt-fine">Starting values. Peebee can change them, and the app always shows the current figure.</p>
          </div>
        </section>
      )}

      <section className="pt-band pt-band-steps">
        <div className="pt-wrap pt-intro">
          <div>
            <p className="pt-label">{p.closed ? "Until then" : "Getting started"}</p>
            {first && <><h2 className="pt-h2">{first.title}</h2><p className="pt-p">{first.text}</p></>}
          </div>
          <ol className="pt-steps">
            {p.steps.map((s, i) => <li key={s}><span>{String(i + 1).padStart(2, "0")}</span>{s}</li>)}
          </ol>
        </div>
      </section>

      {others.length > 0 && (
        <section className="pt-band pt-band-how">
          <div className="pt-wrap">
            <p className="pt-label">How it works for you</p>
            <ul className={`pt-secs pt-secs-${variant}`}>
              {others.map((s, i) => (
                <li key={s.id} id={s.id} className="pt-card">
                  <span className="pt-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  {s.points && <ul>{s.points.map((x) => <li key={x}><Check size={15} aria-hidden />{x}</li>)}</ul>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {pay && (
        <section className="pt-band pt-band-pay" id="pay">
          <div className="pt-wrap pt-pay">
            <div className="pt-pay-ic"><p.icon size={26} aria-hidden /></div>
            <div>
              <p className="pt-label">{pay.title}</p>
              <p className="pt-pay-text">{pay.text}</p>
              {pay.points && <ul>{pay.points.map((x) => <li key={x}><Check size={15} aria-hidden />{x}</li>)}</ul>}
            </div>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className="pt-band pt-band-qs" id="questions" aria-labelledby="pt-qs-title">
          <div className="pt-wrap">
            <h2 className="pt-qs-title" id="pt-qs-title">Questions</h2>
            <PartnerQuestions items={questions} />
          </div>
        </section>
      )}

      <section className="pt-band pt-band-end">
        <div className="pt-wrap">
          {!p.closed && p.app && (
            <div className="pt-end">
              <div><b>Ready when you are.</b><small>Sign up takes a few minutes. Peebee does the checks.</small></div>
              <a href={p.app.url} className="btn btn-gold">Open {p.app.name} <ArrowUpRight size={16} aria-hidden /></a>
            </div>
          )}
          {related.length > 0 && (
            <nav className="pt-related" aria-label="Other partner pages">
              <p className="pt-label">Also on Peebee</p>
              <ul>
                {related.map((r) => (
                  <li key={r.slug}><Link href={`/partners/${r.slug}`} className="pt-card"><span className="pt-tile"><r.icon size={18} aria-hidden /></span><span><b>{r.name}</b><small>{r.who}</small></span><ArrowRight size={16} aria-hidden /></Link></li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>
    </article>
  );
}
