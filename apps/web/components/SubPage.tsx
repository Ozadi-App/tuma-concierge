import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { DOOR_SLUG } from "../lib/door-ids";
import { APP_URL, ORDER_PATH } from "../lib/content";
import { PHOTO_FILES, SUB_BY_ID, type Sub } from "../lib/subs";
import { DoorName } from "./DoorName";
import { ModuleGate, ModuleShow } from "./ModuleNotice";
import { moduleOfSub } from "../lib/module-map";

/** A sub-feature on a page of its own: photo, what it is, how it moves through the order path, cost, partner link, related. */
export function SubPage({ sub }: { sub: Sub }) {
  return <ModuleGate module={moduleOfSub(sub.door, sub.key)} name={sub.title}><SubPageBody sub={sub} /></ModuleGate>;
}

function SubPageBody({ sub }: { sub: Sub }) {
  const photo = PHOTO_FILES[sub.photo];
    const related = sub.related.map((r) => SUB_BY_ID[r]).filter((r) => r && !r.feature);
  const direct = !!sub.direct;
  return (
    <article className="sp wrap">
      <Link href={`/${DOOR_SLUG[sub.door]}`} className="back">
        <ArrowLeft size={16} aria-hidden /> <DoorName id={sub.door} />
      </Link>
      <div className="sp-top">
        <header className="sp-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} style={photo.pos ? { objectPosition: photo.pos } : undefined} />
          <div className="sp-shade" />
          <div className="sp-title">
            <div className="sp-tt">
              <span className="sp-kicker"><sub.icon size={16} aria-hidden /> <DoorName id={sub.door} />{sub.tag && <em>{sub.tag}</em>}</span>
              <h1>{sub.title}</h1>
            </div>
            <span className="sp-bar" aria-hidden />
            <p className="sp-lead">{sub.lead}</p>
          </div>
        </header>

        <div className="sp-below">
          <p className="lead sp-lead-m">{sub.lead}</p>
          {direct && (
            <p className="sp-type">
              {sub.key === "parcels"
                    ? "Parcels is a delivery type, not a module. You choose it inside Ride, and you can send one from Buy."
                    : sub.key === "spotlight"
                      ? "Spotlight lives inside Buy. It is not a door of its own."
                      : "Pharmacy lives inside Buy. It is not a door of its own."}
            </p>
          )}
        </div>

        <aside className="sp-side">
          <section aria-labelledby="sp-get">
            <h2 id="sp-get">What you get</h2>
            <ul className="sp-points">
              {sub.points.map((p) => (
                <li key={p}><Check size={16} aria-hidden /> <span>{p}</span></li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="sp-cost">
            <h2 id="sp-cost">What it costs</h2>
            <p className="sp-cost">{sub.cost}</p>
            {sub.partnerLine && <p className="quiet">{sub.partnerLine}</p>}
          </section>
        </aside>
      </div>
      <section aria-labelledby="sp-path" className="sp-path">
        <h2 id="sp-path">How it moves</h2>
        <ol>
          {ORDER_PATH.map((st, i) => (
            <li key={st.name}>
              <span className="sp-n">{i + 1}</span>
              <b>{st.name}</b>
              <span>{sub.path?.[st.name as keyof typeof sub.path] ?? DEFAULT_STEP[sub.door][st.name]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="sp-partner" aria-labelledby="sp-partner">
        <h2 id="sp-partner">{sub.cta.note ? "Not open yet" : "Get it in the app"}</h2>
        <p>
          {sub.cta.note
            ? "Hire stays off until it is switched on, and Talent, the partner side, has not opened. You can read where it stands."
            : "You order and pay in the Peebee app. Partners join the same way: a verified account, the same order path, and the same PIN at the end."}
        </p>
        <div className="sp-actions">
          {sub.cta.note
            ? <Link href={sub.cta.href} className="btn btn-gold">{sub.cta.label} <ArrowUpRight size={16} aria-hidden /></Link>
            : <a href={APP_URL} className="btn btn-gold">Download the app <ArrowUpRight size={16} aria-hidden /></a>}
          {!sub.cta.note && <Link href={sub.cta.href} className="btn btn-quiet">{sub.cta.label}</Link>}
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="sp-rel">
          <h2 id="sp-rel">Related</h2>
          <ul className="sp-rel">
            {related.map((r) => (
              <ModuleShow key={`${r.door}/${r.key}`} module={moduleOfSub(r.door, r.key)}>
                <li>
                  <Link href={`/${DOOR_SLUG[r.door]}/${r.key}`}>
                    <span className="feat-ic"><r.icon size={20} aria-hidden /></span>
                    <span><b>{r.title}</b><small><DoorName id={r.door} /></small></span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </li>
              </ModuleShow>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

const DEFAULT_STEP: Record<Sub["door"], Record<string, string>> = {
  ride: { Create: "Type where to.", Match: "A verified rider claims it, the nearest takes it, or you pick. A rider may counter with another fee.", Fund: "The fare is held in escrow, not spent.", Work: "The ride happens.", Handover: "You give the rider your four-digit PIN.", Settle: "Escrow pays the rider and Peebee's fee." },
  buy: { Create: "Write the list, or pick a shop and fill a basket.", Match: "A verified rider or the shop takes it. Same three ways of matching.", Fund: "The money is held in escrow, not spent.", Work: "Someone shops or packs, and a rider carries it.", Handover: "You give the PIN when it reaches you.", Settle: "Escrow pays the rider and the shop, and Peebee's fee." },
  eat: { Create: "Pick a kitchen and put dishes in its cart.", Match: "A rider claims the delivery, the nearest takes it, or you pick.", Fund: "The money is held in escrow, not spent.", Work: "The kitchen cooks, and the chat sits on the order.", Handover: "You give the PIN when the food reaches you.", Settle: "Escrow pays the kitchen, the rider, and Peebee's fee." },
  learn: { Create: "Join a class or a course.", Match: "Pick the class or course you want.", Fund: "The fee is held in escrow, not spent.", Work: "The lesson, the quiz, the assignment.", Handover: "A four-digit PIN closes it.", Settle: "Escrow pays the school or tutor, and Peebee's fee. Commission starts at 10%." },
  hive: { Create: "Say what needs doing and when.", Match: "First to claim, nearest in a time window, or your pick.", Fund: "The money is held in escrow, not spent.", Work: "The clean, the wash, the fix.", Handover: "A four-digit PIN closes it when you are happy.", Settle: "Escrow pays the worker, and Peebee's fee. Commission starts at 15%." },
};
