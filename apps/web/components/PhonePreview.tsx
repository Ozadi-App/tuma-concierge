import {
  Bike, Bus, Home, Check, ChevronDown, Flame, KeyRound, Lock, MapPin, MessageCircle, MessagesSquare, Mic, Play, Replace, Search, Send,
  ShieldCheck, Sparkles, Tv, Users, Wrench, WashingMachine, ClipboardList, CarFront, Radio, Compass, GraduationCap, Wallet,
} from "lucide-react";
import { DOOR_CONTENT } from "../lib/content";
import { PHOTOS } from "../lib/photos";
import type { Door, DoorId } from "../lib/doors";
import { Logo } from "./Logo";

/* A drawing of the app, not the app. Every screen is a sample: no names, no balances, no prices. Sized in container units so it scales as one piece. */

function Header() {
  return (
    <div className="ph-head">
      <Logo className="ph-logo" />
      <span className="grow" />
      <ChevronDown size={14} />
      <MessagesSquare size={14} />
    </div>
  );
}

function Nav({ doors, active }: { doors: Door[]; active: DoorId }) {
  return (
    <div className="ph-nav">
      <span className="ph-nav-spot"><Home size={13} /></span>
      <div className="ph-nav-cap">
        {doors.map((d) => {
          const Icon = DOOR_CONTENT[d.id].icon;
          return (
            <span key={d.id} data-on={d.id === active}>
              <Icon size={13} />
              {d.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Screen({ id, doors, children }: { id: DoorId; doors: Door[]; children: React.ReactNode }) {
  return (
    <div className="ph-screen" data-screen={id}>
      <Header />
      <div className="ph-main">{children}</div>
      <Nav doors={doors} active={id} />
    </div>
  );
}

function Img({ id }: { id: DoorId }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ph-img" src={PHOTOS[id].card} alt="" loading="lazy" />;
}

function Trust() {
  return <div className="ph-trust"><ShieldCheck size={11} /> Webale. Verified riders near you.</div>;
}

export function PhoneScreens({ doors }: { doors: Door[] }) {
  return (
    <>
      <Screen id="ride" doors={doors}>
        <Trust />
        <div className="ph-search"><Search size={13} /> Where to?</div>
        <div className="ph-chips"><span data-on="true"><Bike size={11} />Boda</span><span><CarFront size={11} />Car</span><span><Users size={11} />Rideshare</span><span><KeyRound size={11} />Selfdrive</span><span><Bus size={11} />TaxiPress</span></div>
        <div className="ph-card">
          <div className="ph-k">Compare rides</div>
          <div className="ph-two"><span data-on="true">Best value</span><span>Comfort</span></div>
          <div className="ph-sub"><Lock size={11} /> Fare shown up front, held in escrow</div>
        </div>
        <div className="ph-card">
          <div className="ph-row"><MapPin size={13} /><b>Your rider is on the way</b></div>
          <div className="ph-pin"><span>PIN</span><i>•</i><i>•</i><i>•</i><i>•</i></div>
        </div>
        <div className="ph-trio"><span><ShieldCheck size={12} />Verified riders</span><span><MapPin size={12} />Live trip link</span><span><Wallet size={12} />MoMo escrow</span></div>
      </Screen>
      <Screen id="buy" doors={doors}>
        <div className="ph-title"><ClipboardList size={13} /> Ready to shop?</div>
        <div className="ph-field ph-area">2 kg tomatoes, charcoal, rice…<Mic size={12} /></div>
        <div className="ph-chips"><span data-on="true">List</span><span>Groceries</span><span>Stores</span><span>Pharma</span><span><Flame size={11} />Spotlight</span></div>
        <div className="ph-card ph-sub-card">
          <div className="ph-row"><Replace size={13} /><b>Out of stock</b></div>
          <div className="ph-sub">Your rider suggests a substitute. Nothing changes until you say yes.</div>
          <div className="ph-btns"><span data-gold="true">Approve</span><span>No thanks</span></div>
        </div>
        <div className="ph-reels">
          <span><Play size={12} /><em>Live now</em></span>
          <span><Play size={12} /><em>Replay</em></span>
        </div>
      </Screen>
      <Screen id="eat" doors={doors}>
        <div className="ph-search"><Search size={13} /> Search kitchens and dishes</div>
        <div className="ph-chips"><span data-on="true">Restaurants</span><span>Kitchens</span><span>Street food</span><span>Juices</span></div>
        <Img id="eat" />
        <div className="ph-card">
          <div className="ph-row"><b>Being cooked</b></div>
          <div className="ph-progress"><i style={{ width: "58%" }} /></div>
        </div>
        <div className="ph-chat">
          <p className="ph-bub ph-bub-me">Less chilli, please.</p>
          <p className="ph-bub">Noted. Almost ready.</p>
          <div className="ph-input"><MessageCircle size={11} /> Message the kitchen <Send size={11} /></div>
        </div>
      </Screen>
      <Screen id="learn" doors={doors}>
        <div className="ph-search"><Search size={13} /> Search courses, schools, subjects</div>
        <div className="ph-chips"><span data-on="true"><GraduationCap size={11} />My Class</span><span><Radio size={11} />Live</span><span><Tv size={11} />TV</span><span><Compass size={11} />Discover</span></div>
        <div className="ph-chips ph-chips-wrap"><span data-on="true">Foundations</span><span>Sprouts</span><span>Academy</span><span>Compass</span><span>Skills</span></div>
        <div className="ph-card">
          <div className="ph-k">Next lesson</div>
          <div className="ph-row"><b>Fractions, part 2</b></div>
          <div className="ph-progress"><i style={{ width: "40%" }} /></div>
        </div>
        <div className="ph-card"><div className="ph-row"><Tv size={13} /><b>Watch on Peebee TV</b></div><div className="ph-sub">Enter the code from your account.</div></div>
      </Screen>
      <Screen id="hive" doors={doors}>
        <div className="ph-title"><Sparkles size={13} /> What needs doing?</div>
        <div className="ph-grid3">
          <span><Sparkles size={16} />Clean</span>
          <span data-on="true"><WashingMachine size={16} />Laundry</span>
          <span><Wrench size={16} />Fix</span>
        </div>
        <div className="ph-chips"><span data-on="true">Now</span><span>Pick a time</span></div>
        <div className="ph-card">
          <div className="ph-k">Your price</div>
          <div className="ph-field" />
          <div className="ph-sub">Add a tip if the work earns one.</div>
        </div>
        <div className="ph-card"><div className="ph-row"><Wallet size={13} /><b>Held until it is done</b></div><div className="ph-sub">Hand over the PIN when you are happy.</div></div>
      </Screen>
    </>
  );
}
