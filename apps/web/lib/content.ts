import {
  Bike, CarFront, Bus, ClipboardList, Store, Clapperboard, Link2, Replace, UtensilsCrossed, ChefHat, Flame, CupSoda,
  Croissant, MessageCircle, Sprout, BookOpen, GraduationCap, Compass, Hammer, Tv, Sparkles, Shirt, Wrench, HardHat,
  BriefcaseBusiness, Briefcase, Route, ShoppingBag, ShoppingBasket, ShoppingCart, Wallet, Pill, Package, Fuel, ShieldCheck, Handshake, Clock, Users, KeyRound, Ticket,
  Truck, Crown, Ambulance, CookingPot, Citrus, Radio, MessagesSquare, Backpack, WashingMachine, Bell, MapPin, Languages, ChevronRight, Settings, Smartphone, WifiOff, Share2, Mic, Star, UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { DoorId } from "./door-ids";
import { SUBS, type Item, type Sub } from "./subs";

export type { Item, Sub };
const itemsOf = (d: DoorId): Sub[] => SUBS.filter((x) => x.door === d && !x.feature);
const featsOf = (d: DoorId): Sub[] => SUBS.filter((x) => x.door === d && x.feature);

export const APP_URL = "https://app.peebee.online";


export type DoorContent = {
  icon: LucideIcon;
  tile: string; // one line under the name on a picture tile
  /** a few second-person sentences under the photo in the drawer */
  about: string;
  headline: string; // drawer title
  lead: string;
  heroTitle: string; // desktop hero
  heroSub: string;
  /** services: sub-modules with pages of their own */
  items: Sub[];
  /** supporting features, shown as pop-ups */
  features: Sub[];
  note?: { icon: LucideIcon; title: string; text: string; href?: string };
  next: DoorId;
};

export const DOOR_CONTENT: Record<DoorId, DoorContent> = {
  ride: {
    about: "You need to be somewhere, and Ride puts someone already moving towards you. Ask for a boda when the road is jammed, a car when it is raining or you have company, or a seat on a fixed route when you know the stage. You pick how you are matched: first to claim, the nearest inside a time window, or a rider you choose. The fare waits in escrow while you travel, and it moves only after you give the rider your four-digit PIN. Fuel is a benefit for the rider on the job, so it never shows up on your bill.",
    icon: Route,
    tile: "Boda, cars, a seat on the route",
    headline: "Somewhere to be. Someone already on the way.",
    lead: "Type where to, and compare what comes back. Every trip ends the same way: a four-digit PIN, and the money is released.",
    heroTitle: "Your ride is already on its way.",
    heroSub: "A boda at the corner, a car for tonight, a seat on the morning route.",
    items: itemsOf("ride"),
    features: featsOf("ride"),
    next: "buy",
  },
  buy: {
    about: "Write the list, say it out loud, or open a link a friend sent, and a verified rider walks the market for you. You set the budget, so nothing is bought without your say. If a stall has run out, the rider proposes a substitute, and nothing swaps in until you approve it. Shops are paid only after your order has reached you. Prefer to look first? Spotlight shows what is fresh right now, live from the market floor.",
    icon: ShoppingBag,
    tile: "Send a list, shop, watch Spotlight",
    headline: "Post the list. Someone else walks the market.",
    lead: "Peebee began here. Write what you need and a verified rider buys it and brings it. The same door holds stores, groceries, and short videos from the market floor.",
    heroTitle: "Write the list. The market comes to you.",
    heroSub: "Stores, groceries, and a rider who knows which stall to trust.",
    items: itemsOf("buy"),
    features: featsOf("buy"),
    note: {
      icon: Package,
      href: "/ride/parcels",
      title: "Sending instead of buying?",
      text: "Across town, one rider carries your parcel. Further out, about 25 km or more, it changes hands: boda, then taxi, then a last boda. Fuel stations can be the drop and the pickup, and the last rider still closes it with a PIN.",
    },
    next: "eat",
  },
  eat: {
    about: "Somebody nearby is about to cook your dinner. Restaurants, home kitchens, the rolex stall at the corner, a juice counter and the bakery down the road all sit in one door. Each kitchen keeps its own cart, so a plate of food never gets tangled up with the shopping. Ask about the chilli or tell the rider which gate, right on the order, and it all stays there. When the food reaches you, the PIN closes it and the kitchen is paid.",
    icon: UtensilsCrossed,
    tile: "Kitchens, stalls, bakeries",
    headline: "Hungry, and the kitchen already knows.",
    lead: "Restaurants, home kitchens, and the stall with the best rolex on your road sit side by side. Order, and keep the conversation on the order itself.",
    heroTitle: "Dinner, plated by someone nearby.",
    heroSub: "From a home kitchen to the chapati stall at the corner.",
    items: itemsOf("eat"),
    features: featsOf("eat"),
    next: "learn",
  },
  learn: {
    about: "Learning here starts at the first letter and goes as far as a first trade. Five streams hold it all: Sprouts for ages 3 to 6, Foundations for primary, Academy for secondary, Compass for university, and Skills for work. Each one follows school, class, course, module and lesson, with quizzes, exams, assignments, a gradebook and a certificate at the end. Sit in a live room from your phone, and when a lesson deserves a bigger screen, open it on Peebee TV with a code from your account.",
    icon: BookOpen,
    tile: "Sprouts to Skills",
    headline: "A class for every age, in the same pocket as everything else.",
    lead: "Five streams, from a first letter to a first trade. Each one runs school, class, course, module, lesson, with quizzes, exams, assignments, a gradebook, and certificates at the end.",
    heroTitle: "Class starts wherever you are sitting.",
    heroSub: "Five streams, live rooms, and lessons that follow you to the television.",
    items: itemsOf("learn"),
    features: featsOf("learn"),
    next: "hive",
  },
  hive: {
    about: "Some things just need a person. Work is where you ask for a clean, a wash, a fix or an odd job, and see a catalogue price, or ask for a quote when the job is hard to size up from a distance. You choose how it is matched: the first person to claim it, the nearest inside a time window, or somebody you pick. The money waits in escrow while the job is done, and you hand over the PIN only when you are happy. Hire, for a longer project, lives in the same door and stays off until it is switched on.",
    icon: BriefcaseBusiness,
    tile: "Clean, laundry, fix",
    headline: "A tidy home, without the chasing.",
    lead: "Clean, laundry, fix. A job shows a catalogue price, or you ask for a quote when it is harder to size up from a distance.",
    heroTitle: "A clean home, a fixed door, a folded shirt.",
    heroSub: "Book it, watch it get done, hand over the PIN when you are happy.",
    items: itemsOf("hive"),
    features: featsOf("hive"),
    next: "ride",
  },
};

export const ORDER_PATH = [
  { name: "Create", text: "Say what you need." },
  { name: "Match", text: "First to claim, nearest in a time window, or your pick. A rider may counter with another fee." },
  { name: "Fund", text: "The money is held in escrow, not spent." },
  { name: "Work", text: "The ride, the shopping, the cooking, the lesson, the clean." },
  { name: "Handover", text: "A four-digit PIN closes it." },
  { name: "Settle", text: "Escrow pays the rider, the shop or kitchen, and Peebee's fee." },
];

export const WALLET_NOTE =
  "One wallet under everything. Top up from MTN MoMo or Airtel Money, pay from the balance, send some to a friend, take a refund. What a job costs sits in escrow until the work is done, and every movement is written twice.";

export const ALSO_IN_ACCOUNT: { icon: LucideIcon; title: string; short: string; text: string; href: string; feature?: string }[] = [
  { href: "/wallet", feature: "acct/wallet", icon: Wallet, title: "Wallet", short: "MoMo or Airtel Money in, balance, transfer, refund.", text: "MTN MoMo and Airtel Money in. Balance, transfer and refund out. Escrow holds what a job costs, and each movement is written twice." },
  { href: "/buy/pharmacy", icon: Pill, title: "Pharmacy", short: "A photo of the prescription, filled by a licensed pharmacy.", text: "Take a photo of the prescription. A licensed pharmacy fills it from its own stock. Pharmacies are licensed with the NDA. What a script costs is not settled yet, so nothing is quoted here." },
  { href: "/ride/parcels", feature: "ride/parcels", icon: Package, title: "Parcels", short: "One rider across town. 25 km or more, it changes hands.", text: "Across town, one rider. Further out, about 25 km or more, the parcel changes hands: boda, taxi, then a last boda. The last rider still closes with a PIN." },
];

/** What the account menu in the app holds. Shown in the site menu so the same things are easy to find. */
export const IN_THE_APP: { icon: LucideIcon; title: string; short: string; href: string }[] = [
  { href: "/cart", icon: ShoppingBag, title: "Unified cart", short: "Mix shops and restaurants in one cart, check out once." },
  { href: "/orders", icon: Package, title: "Orders", short: "Everything you have ordered, to buy again." },
  { href: "/track", icon: MapPin, title: "Track", short: "Follow a delivery step by step, or type a tracking code." },
  { href: "/chat", icon: MessagesSquare, title: "Chat and calls", short: "Talk to the rider or the kitchen, with voice notes." },
  { href: "/notifications", icon: Bell, title: "Notifications", short: "Matched, funded, on the way, handed over." },
  { href: "/settings", icon: Settings, title: "Settings", short: "Saved places such as Home and Office. English and Luganda." },
  { href: "/install", icon: Smartphone, title: "On your home screen", short: "Install it like an app. It tells you when you are offline." },
];

/** Sample wallet cards on the home screen. Labels only: no balances, no names. */
export const WALLET_CARDS = [
  { id: "own", icon: Wallet, kicker: "Personal MoMo escrow", badge: "Protected", sub: "Your balance and limit show here once you sign in." },
  { id: "family", icon: Users, kicker: "Family pool", badge: "Shared with you", sub: "A wallet someone shares with you, for orders only." },
  { id: "staff", icon: UserCheck, kicker: "Staff and family access", badge: "You manage", sub: "Share yours with the people you choose, and stop any time." },
];

/* ---------------- Partners ---------------- */

export type PartnerSlug = "food" | "shops" | "pharmacy" | "rides" | "home" | "learn" | "talent";

export type PartnerBlock = { id?: string; icon: LucideIcon; title: string; text: string };
export type Figure = { label: string; value: string; note?: string };

export type Partner = {
  slug: PartnerSlug;
  name: string;
  icon: LucideIcon;
  who: string; // short card line
  headline: string;
  lead: string;
  photo: string;
  alt: string;
  app?: { name: string; url: string };
  appExtra?: { name: string; url: string };
  blocks: PartnerBlock[];
  figures?: Figure[];
  figuresTitle?: string;
  closed?: boolean;
  after?: string;
};

export const PARTNERS: Partner[] = [
  {
    slug: "food",
    name: "Food",
    icon: UtensilsCrossed,
    who: "You already cook.",
    headline: "You already cook. Let the orders find you.",
    lead: "Restaurant, home kitchen, rolex stand, juice bar, bakery. Your orders arrive in your own app, the chat sits on each order, and the money moves when the plate is handed over.",
    photo: "/photos/sub-home-rolex.webp",
    alt: "A gourmet rolex cut in half on a slate board, a chef in whites behind (AI-generated)",
    app: { name: "Open the restaurant app", url: "https://food.peebee.online" },
    blocks: [
      { id: "restaurants", icon: UtensilsCrossed, title: "Restaurants", text: "Menus, prices and opening times kept in your hands." },
      { id: "kitchens", icon: ChefHat, title: "Home kitchens", text: "A small kitchen is enough. Cook what you cook best." },
      { id: "street", icon: Flame, title: "Street food", text: "Rolex, chapati and the rest, from the stall you already run." },
      { id: "juice", icon: CupSoda, title: "Juice and smoothies", text: "Counters that sell by the cup." },
      { id: "bakeries", icon: Croissant, title: "Bakeries", text: "Bread, buns and cakes, ordered ahead." },
      { id: "chat", icon: MessageCircle, title: "Chat on every order", text: "Answer a question about the chilli without leaving the order." },
      { id: "paid", icon: ShieldCheck, title: "Paid at the PIN", text: "When the rider gives the PIN at handover, escrow pays you, the rider, and Peebee's fee. Fees are settings, so check yours in the app." },
    ],
  },
  {
    slug: "shops",
    name: "Shops",
    icon: Store,
    who: "You already sell.",
    headline: "You already sell. Put the shelf in a pocket.",
    lead: "The merchant app is for the person behind the counter. Twelve store types, including supermarkets, boutiques, electronics, butchers, hardware and bookshops. Baskets start at UGX 5,000.",
    photo: "/photos/sub-home-counter.webp",
    alt: "A shop owner smiling behind the counter of her modern boutique grocery (AI-generated)",
    app: { name: "Open the merchant app", url: "https://merchant.peebee.online" },
    blocks: [
      { id: "store-types", icon: Store, title: "Twelve store types", text: "Supermarkets, boutiques, electronics, butchers, hardware, bookshops and more." },
      { id: "substitutes", icon: Handshake, title: "Substitutes you approve", text: "When an item is out, the rider proposes a replacement. Nothing swaps in until the buyer approves it." },
      { id: "spotlight", icon: Clapperboard, title: "Spotlight", text: "Short video from your own stall, in front of people who are about to shop." },
    ],
    figuresTitle: "Plans, at their starting values",
    figures: [
      { label: "To start", value: "10% commission", note: "Where every shop begins." },
      { label: "Pro", value: "UGX 35,000", note: "UGX 75,000 with live selling. Free until it is turned on." },
      { label: "Elite", value: "UGX 150,000", note: "5% commission, with a till, loyalty and customer tools." },
      { label: "Basket", value: "from UGX 5,000", note: "The smallest basket." },
    ],
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    icon: Pill,
    who: "You already dispense.",
    headline: "You already dispense. The prescription arrives as a photo.",
    lead: "The pharmacy app has two rooms: an inbox for the prescriptions that come in, and your stock. A licensed pharmacy fills each one from what is on its own shelves. The licence sits with the NDA.",
    photo: "/photos/sub-home-late-light.webp",
    alt: "A pharmacist handing a prescription bag to a customer in a modern pharmacy (AI-generated)",
    app: { name: "Open the pharmacy app", url: "https://pharmacy.peebee.online" },
    blocks: [
      { id: "inbox", icon: Pill, title: "Inbox", text: "Prescription photos from people nearby, waiting to be read and filled." },
      { id: "stock", icon: Package, title: "Stock", text: "What you hold, kept current, so a script is only filled from what is really there." },
      { id: "licensed", icon: ShieldCheck, title: "Licensed only", text: "Pharmacies sign up with a licence held with the NDA." },
    ],
    after: "There is no price to show here. Pricing of a prescription is not settled, and this page will not pretend otherwise.",
  },
  {
    slug: "rides",
    name: "Rides",
    icon: Bike,
    who: "You already ride, or own a car.",
    headline: "You already ride, or your car sits idle. Put the road to work.",
    lead: "One page for boda riders, car owners, car drivers, and TaxiPress. Riders use the rider app. Cars use the car app. Cash is allowed, and the rest of the money moves when the work is done.",
    photo: "/photos/hero-ride.webp",
    alt: "A boda rider and passenger on a palm-lined boulevard below city towers at golden hour",
    app: { name: "Open the rider app", url: "https://rider.peebee.online" },
    appExtra: { name: "Open the car app", url: "https://car.peebee.online" },
    blocks: [
      { id: "boda", icon: Bike, title: "Boda riders", text: "Claim a job first, take the nearest one, or offer a different fee. Every job closes with a PIN." },
      { id: "owners", icon: KeyRound, title: "Car owners", text: "List a car, and switch it off whenever you need it back." },
      { id: "drivers", icon: CarFront, title: "Car drivers", text: "Drive on demand, scheduled, or a shared seat. Rentals run for up to 30 days." },
      { id: "taxipress", icon: Ticket, title: "TaxiPress", text: "Sell seats on a fixed route from the queue at the stage. Commission is a percent or a flat fee." },
      { id: "fuel", icon: Fuel, title: "Fuel, for riders", text: "A benefit for the rider on that job: a voucher redeemed at the pump, up to UGX 60,000 a rider a day as a starting cap. Keep a pump? Your forecourt can also be a parcel drop and pickup." },
      { id: "noshow", icon: Clock, title: "No-shows and cancellations", text: "Fees for either can be set. They are settings, not fixed rules." },
      { id: "subscription", icon: Handshake, title: "Rider subscription", text: "It exists, and it stays off unless it is turned on.", },
    ],
    figuresTitle: "Cars on demand, at their starting values",
    figures: [
      { label: "Fare", value: "UGX 2,000 per km", note: "Minimum UGX 8,000." },
      { label: "Owner", value: "60%" },
      { label: "Driver", value: "30%" },
      { label: "Peebee", value: "10%" },
      { label: "Fuel voucher cap", value: "UGX 60,000", note: "Per rider, per day." },
    ],
  },
  {
    slug: "home",
    name: "Home",
    icon: Wrench,
    who: "You already clean, fix, or wash.",
    headline: "You already clean, fix, or wash. Take the jobs that suit you.",
    lead: "The work app is for clean, repair and laundry. Work as one person, or run a company with a team. Home services start at 15% commission.",
    photo: "/photos/hero-hive.webp",
    alt: "A woman in a crisp uniform polishing a marble counter in a modern apartment",
    app: { name: "Open the work app", url: "https://work.peebee.online" },
    blocks: [
      { id: "clean", icon: Sparkles, title: "Clean", text: "A catalogue price, or a quote you set after seeing the job." },
      { id: "repair", icon: Wrench, title: "Repair", text: "Fix what is broken, priced the way you price it." },
      { id: "laundry", icon: Shirt, title: "Laundry", text: "Laundry can take the buyer's own price, and a tip on top." },
      { id: "team", icon: Users, title: "One person or a team", text: "Start alone, or bring the whole crew under a company." },
    ],
    figuresTitle: "At its starting value",
    figures: [{ label: "Commission on home services", value: "15%", note: "A setting, and it may have changed." }],
  },
  {
    slug: "learn",
    name: "Learn",
    icon: GraduationCap,
    who: "You already teach.",
    headline: "You already teach. Your class can sit in a pocket.",
    lead: "The school app holds courses, live classes, exams and fees, and sends the same lessons to Peebee TV. Five streams are open: Sprouts, Foundations, Academy, Compass and Skills.",
    photo: "/photos/hero-learn.webp",
    alt: "A young woman on a video lesson in a high-rise study with city views (AI-generated)",
    app: { name: "Open the school app", url: "https://learn.peebee.online" },
    appExtra: { name: "Peebee TV", url: "https://tv.peebee.online" },
    blocks: [
      { id: "courses", icon: BookOpen, title: "Courses", text: "School, class, course, module, lesson, in that order." },
      { id: "live", icon: Users, title: "Live classes", text: "A live room for the sessions that need a voice." },
      { id: "exams", icon: ClipboardList, title: "Exams, quizzes, assignments", text: "Set them, mark them, and keep a gradebook. Certificates go out at the end." },
      { id: "fees", icon: Wallet, title: "Fees", text: "Learners pay through the wallet, held in escrow until the work is done." },
      { id: "tv", icon: Tv, title: "The television", text: "Lessons open on Peebee TV with a code from the learner's account." },
    ],
    figuresTitle: "At its starting value",
    figures: [{ label: "Commission", value: "10%", note: "A setting, and it may have changed." }],
  },
  {
    slug: "talent",
    name: "Talent",
    icon: BriefcaseBusiness,
    who: "Not open yet.",
    headline: "Talent has not opened.",
    lead: "Gigs and hiring are built, and switched off. There is no screen for it in the customer app and none for partners, so there is nothing to join and nothing to download yet.",
    photo: "/photos/sub-home-skyline.webp",
    alt: "Modern Kampala towers among green hills at golden hour (AI-generated)",
    closed: true,
    blocks: [{ icon: Clock, title: "Not yet", text: "When it opens, this page will say so. Until then, it is closed on purpose." }],
  },
];

export const PARTNER_BY_SLUG = Object.fromEntries(PARTNERS.map((p) => [p.slug, p])) as Record<PartnerSlug, Partner>;
