import {
  Bike, CarFront, Bus, ClipboardList, Store, Link2, Replace, UtensilsCrossed, ChefHat, Flame, Croissant, MessageCircle, Sprout, GraduationCap, Compass, Hammer, Tv, Sparkles,
  Wrench, HardHat, Briefcase, ShoppingBasket, ShoppingCart, Pill, Package, ShieldCheck, Handshake, Users, KeyRound, Truck, Crown, Ambulance, CookingPot, Citrus, Radio,
  MessagesSquare, Backpack, WashingMachine, Search, type LucideIcon,
} from "lucide-react";
import type { DoorId } from "./door-ids";

/**
 * Every sub-feature of a door: the pill and accordion in the door drawer, and its own page at /<door>/<slug>.
 * No prices are invented here. A figure appears only where the brief gives one, and says it is a starting value.
 */

export type Item = {
  icon: LucideIcon;
  title: string;
  text: string;
  tag?: string;
  /** the sub-feature slug; the pill row and the accordion use it */
  key: string;
  chip?: string;
  /** the pill goes straight to its own page instead of opening a section (Spotlight, Pharmacy, Parcels) */
  direct?: boolean;
  /** a supporting feature, not a service: shown as a pop-up under "Also in the app", never as a service row */
  feature?: boolean;
};

export type Cta = { label: string; href: string; note?: string };
export type PhotoKey = "sub-boda" | "sub-cars" | "sub-rideshare" | "sub-selfdrive" | "sub-move" | "sub-parcels" | "sub-taxipress" | "sub-vip" | "sub-ambulance" | "sub-safety" | "sub-list" | "sub-groceries" | "sub-stores" | "sub-pharmacy" | "sub-spotlight" | "sub-shared-links" | "sub-substitutes" | "sub-restaurants" | "sub-home-kitchens" | "sub-street-food" | "sub-juices" | "sub-bakeries" | "sub-chat" | "sub-carts" | "sub-my-class" | "sub-live" | "sub-tv" | "sub-discover" | "sub-connect" | "sub-sprouts" | "sub-foundations" | "sub-academy" | "sub-compass" | "sub-skills" | "sub-clean" | "sub-laundry" | "sub-fix" | "sub-workers" | "sub-hire" | "sub-matching" | "sub-acct-wallet" | "sub-acct-cart" | "sub-acct-orders" | "sub-acct-track" | "sub-acct-notifications" | "sub-acct-settings" | "sub-acct-install" | "sub-home-rolex" | "sub-home-counter" | "sub-home-late-light" | "sub-home-skyline" | "ride" | "buy" | "eat" | "learn" | "hive";
export type StepName = "Create" | "Match" | "Fund" | "Work" | "Handover" | "Settle";

export type Sub = Item & {
  door: DoorId;
  photo: PhotoKey;
  /** the page's opening paragraph */
  lead: string;
  /** a few plain lines on what you get */
  points: string[];
  /** only the steps that read differently here; the rest use the door's wording */
  path?: Partial<Record<StepName, string>>;
  cost: string;
  cta: Cta;
  cta2?: Cta;
  /** other sub-features, as "door/slug" */
  related: string[];
  /** a short line for partners, with the starting value where the brief gives one */
  partnerLine?: string;
};

export const PHOTO_FILES: Record<PhotoKey, { src: string; alt: string; pos?: string }> = {
  "sub-boda": { src: "/photos/sub-boda.webp", alt: "A boda rider in a full-face helmet on a modern motorbike beside a smartly dressed passenger at golden hour (AI-generated)" },
  "sub-cars": { src: "/photos/sub-cars.webp", alt: "A woman in a smart blazer in the back of a clean dark sedan on a palm-lined city road (AI-generated)" },
  "sub-rideshare": { src: "/photos/sub-rideshare.webp", alt: "Two well-dressed professionals sharing the back seat of a car, city towers outside (AI-generated)" },
  "sub-selfdrive": { src: "/photos/sub-selfdrive.webp", alt: "A man in a tailored jacket beside a modern rental car on a clean paved driveway (AI-generated)" },
  "sub-move": { src: "/photos/sub-move.webp", alt: "Uniformed movers carrying boxes from a van as a couple looks on outside a modern home (AI-generated)" },
  "sub-parcels": { src: "/photos/sub-parcels.webp", alt: "A uniformed courier handing a wrapped parcel across a marble reception counter (AI-generated)" },
  "sub-taxipress": { src: "/photos/sub-taxipress.webp", alt: "Commuters boarding a clean white minibus at a modern covered stop (AI-generated)" },
  "sub-vip": { src: "/photos/sub-vip.webp", alt: "A chauffeur opening the door of a black car for a woman in an evening dress (AI-generated)" },
  "sub-ambulance": { src: "/photos/sub-ambulance.webp", alt: "Paramedics with a stretcher beside a white ambulance at a modern clinic entrance (AI-generated)" },
  "sub-safety": { src: "/photos/sub-safety.webp", alt: "A woman in a car at dusk checking a live trip on her tablet (AI-generated)" },
  "sub-list": { src: "/photos/sub-list.webp", alt: "A man adding items to a shopping list on his phone in a modern kitchen (AI-generated)" },
  "sub-groceries": { src: "/photos/sub-groceries.webp", alt: "A woman at her front door receiving a paper bag of fresh groceries (AI-generated)" },
  "sub-stores": { src: "/photos/sub-stores.webp", alt: "A shopper browsing tailored clothes on rails in an elegant boutique (AI-generated)" },
  "sub-pharmacy": { src: "/photos/sub-pharmacy.webp", alt: "A pharmacist in a white coat helping a customer at a bright pharmacy counter (AI-generated)" },
  "sub-spotlight": { src: "/photos/sub-spotlight.webp", alt: "Three professionals looking at a phone together in a modern office (AI-generated)" },
  "sub-shared-links": { src: "/photos/sub-shared-links.webp", alt: "Two friends on a designer sofa sharing a link on their phones (AI-generated)" },
  "sub-substitutes": { src: "/photos/sub-substitutes.webp", alt: "A woman on a phone call choosing fruit in an immaculate supermarket aisle (AI-generated)" },
  "sub-restaurants": { src: "/photos/sub-restaurants.webp", alt: "Friends dining in an elegant restaurant as a waiter serves plates (AI-generated)" },
  "sub-home-kitchens": { src: "/photos/sub-home-kitchens.webp", alt: "A home cook plating a dish in a modern marble kitchen (AI-generated)" },
  "sub-street-food": { src: "/photos/sub-street-food.webp", alt: "A uniformed vendor in apron, cap and gloves serving a customer at a stainless-steel street stall (AI-generated)" },
  "sub-juices": { src: "/photos/sub-juices.webp", alt: "Fresh mango, passion fruit, watermelon and green juices on a polished counter (AI-generated)" },
  "sub-bakeries": { src: "/photos/sub-bakeries.webp", alt: "A smiling baker behind a glass case of fresh pastries in a modern bakery (AI-generated)" },
  "sub-chat": { src: "/photos/sub-chat.webp", alt: "A woman messaging on her phone beside a plated meal in a stylish apartment (AI-generated)" },
  "sub-carts": { src: "/photos/sub-carts.webp", alt: "Hands reaching for burgers, salads and grilled dishes from several kitchens (AI-generated)" },
  "sub-my-class": { src: "/photos/sub-my-class.webp", alt: "A young man studying on a laptop in a modern study room (AI-generated)" },
  "sub-live": { src: "/photos/sub-live.webp", alt: "A teacher leading a live video class with students on a large screen (AI-generated)" },
  "sub-tv": { src: "/photos/sub-tv.webp", alt: "A family on a sofa watching an educational programme on a wall TV (AI-generated)" },
  "sub-discover": { src: "/photos/sub-discover.webp", alt: "A woman browsing colourful courses on a tablet in a stylish café (AI-generated)" },
  "sub-connect": { src: "/photos/sub-connect.webp", alt: "A woman wearing a headset on a video call with a tutor (AI-generated)" },
  "sub-sprouts": { src: "/photos/sub-sprouts.webp", alt: "Two young children learning on tablets on a sofa as their mother smiles behind them (AI-generated)" },
  "sub-foundations": { src: "/photos/sub-foundations.webp", alt: "A primary pupil doing an online lesson on a laptop as his mother encourages him (AI-generated)" },
  "sub-academy": { src: "/photos/sub-academy.webp", alt: "Four secondary students in blazers working together on a laptop and tablet (AI-generated)" },
  "sub-compass": { src: "/photos/sub-compass.webp", alt: "A graduate in a blazer taking notes during a video call, city towers behind (AI-generated)" },
  "sub-skills": { src: "/photos/sub-skills.webp", alt: "A young woman in an apron learning to pipe cream onto cakes in a modern pastry studio (AI-generated)" },
  "sub-clean": { src: "/photos/sub-clean.webp", alt: "Two uniformed cleaners vacuuming and polishing in a luxurious living room (AI-generated)" },
  "sub-laundry": { src: "/photos/sub-laundry.webp", alt: "A woman with neatly folded towels beside a stacked washer and dryer in a modern laundry room (AI-generated)" },
  "sub-fix": { src: "/photos/sub-fix.webp", alt: "A uniformed technician servicing a stainless-steel fridge as the homeowner looks on (AI-generated)" },
  "sub-workers": { src: "/photos/sub-workers.webp", alt: "A uniformed chef, cleaner, technician and driver standing together in a marble lobby (AI-generated)" },
  "sub-hire": { src: "/photos/sub-hire.webp", alt: "A couple shaking hands with a uniformed professional at the door of their home (AI-generated)" },
  "sub-matching": { src: "/photos/sub-matching.webp", alt: "A woman on a sofa browsing service professionals on her phone (AI-generated)" },
  "sub-acct-wallet": { src: "/photos/sub-acct-wallet.webp", alt: "A woman paying with her phone at a contactless terminal on a marble counter (AI-generated)" },
  "sub-acct-cart": { src: "/photos/sub-acct-cart.webp", alt: "A man pushing a trolley through a bright supermarket, checking his phone (AI-generated)" },
  "sub-acct-orders": { src: "/photos/sub-acct-orders.webp", alt: "A woman receiving shopping bags from a uniformed courier at her door (AI-generated)" },
  "sub-acct-track": { src: "/photos/sub-acct-track.webp", alt: "A man in a suit checking his phone as a black car waits at the kerb (AI-generated)" },
  "sub-acct-notifications": { src: "/photos/sub-acct-notifications.webp", alt: "A woman smiling at her phone on a balcony at dusk, city lights behind (AI-generated)" },
  "sub-acct-settings": { src: "/photos/sub-acct-settings.webp", alt: "A man working on a laptop on a sofa in a calm, sunlit living room (AI-generated)" },
  "sub-acct-install": { src: "/photos/sub-acct-install.webp", alt: "A smiling man holding up a phone on a rooftop above Kampala's skyline (AI-generated)" },
  "sub-home-rolex": { src: "/photos/sub-home-rolex.webp", alt: "A gourmet rolex cut in half on a slate board, a chef in whites behind (AI-generated)" },
  "sub-home-counter": { src: "/photos/sub-home-counter.webp", alt: "A shop owner smiling behind the counter of her modern boutique grocery (AI-generated)" },
  "sub-home-late-light": { src: "/photos/sub-home-late-light.webp", alt: "A pharmacist handing a prescription bag to a customer in a modern pharmacy (AI-generated)" },
  "sub-home-skyline": { src: "/photos/sub-home-skyline.webp", alt: "Modern Kampala towers among green hills at golden hour (AI-generated)" },
  ride: { src: "/photos/card-ride.webp", alt: "A boda rider and passenger on a palm-lined boulevard below city towers at golden hour (AI-generated)" },
  buy: { src: "/photos/card-buy.webp", alt: "A woman choosing fresh produce outside an elegant modern grocery (AI-generated)" },
  eat: { src: "/photos/card-eat.webp", alt: "A couple dining on a terrace over the city at sunset (AI-generated)" },
  learn: { src: "/photos/card-learn.webp", alt: "A young woman on a video lesson in a high-rise study with city views (AI-generated)" },
  hive: { src: "/photos/card-hive.webp", alt: "A woman in a crisp uniform polishing a marble counter in a modern apartment (AI-generated)" },
};


const S = (door: DoorId, o: Omit<Sub, "door">): Sub => ({ door, ...o });

export const SUBS: Sub[] = [
  /* ───────────────── Ride ───────────────── */
  S("ride", {
    key: "boda", icon: Bike, title: "Boda", photo: "sub-boda",
    text: "A verified rider is matched to you, whether that's the first to claim, the nearest inside a time window, or the one you pick. Riders can offer a different fee.",
    lead: "A boda is the quickest way through Kampala, and here every rider is verified before they can claim a trip. You say where to, and the fare shows up front. You choose how you are matched, and the money stays in escrow until you are there.",
    points: ["Matched three ways: first to claim, nearest inside a time window, or the rider you pick.", "A rider may counter with another fee. Nothing is agreed until you say yes.", "Share the live trip with someone who is waiting for you.", "Fuel is a benefit for the rider on the job. It is not something you buy."],
    path: { Create: "Type where to, and see the fare.", Work: "Your rider takes you there. The trip link shows someone else where you are.", Handover: "Arrived? Say your four-digit PIN to the rider." },
    cost: "You see the fare before you fund it. No other figure is quoted here.",
    cta: { label: "Become a rider", href: "/partners/boda" },
    related: ["ride/cars", "ride/parcels", "ride/safety"],
    partnerLine: "Boda riders claim a job first, take the nearest one, or offer a different fee. Every job closes with a PIN.",
  }),
  S("ride", {
    key: "cars", icon: CarFront, title: "Cars", chip: "Cars", photo: "sub-cars",
    text: "Book a car right now or schedule one for later. Choose the size that fits your group, or pick the comfort ride when the day has been long.",
    lead: "When you are carrying shopping, wearing good shoes or travelling with company, a car is the better call. Ask for one now, or book it for later. Pick a size, or choose the comfort ride when the day has been long.",
    points: ["On demand, or scheduled for a time you choose.", "Pick the car size that fits your people and your bags.", "The comfort ride is there for the long days.", "Same match options, same PIN at the end."],
    path: { Create: "Say where to, now or later, and choose a car size.", Work: "The driver picks you up and takes you there." },
    cost: "Cars on demand start at UGX 2,000 per km, with a minimum of UGX 8,000. Those are starting values and may have changed. The fare shows before you fund it.",
    cta: { label: "List your car", href: "/partners/car-owner" },
    cta2: { label: "Drive with Peebee", href: "/partners/driver" },
    related: ["ride/boda", "ride/rideshare", "ride/selfdrive", "ride/vip"],
    partnerLine: "Car owners list a car and switch it off whenever they need it back. Drivers go on demand, scheduled, or with a shared seat.",
  }),
  S("ride", {
    key: "rideshare", icon: Users, title: "Rideshare", photo: "sub-rideshare",
    text: "Take a single shared seat in a car already heading your way. You split the road with others and pay less than a whole car, without waiting longer.",
    lead: "Not everyone needs a whole car. Rideshare gives you one seat in a car that is already going your way, so you share the road and the trip.",
    points: ["One seat, not the whole car.", "The car is already heading in your direction.", "The trip still closes with your PIN."],
    path: { Create: "Say where you are going and take a seat.", Work: "You ride along with the others in the car." },
    cost: "You see the seat price before you fund it. No figure is quoted here.",
    cta: { label: "Share your trips", href: "/partners/rideshare" },
    related: ["ride/cars", "ride/taxipress", "ride/boda"],
    partnerLine: "Car drivers can offer a shared seat on a trip they are making anyway.",
  }),
  S("ride", {
    key: "selfdrive", icon: KeyRound, title: "Selfdrive", photo: "sub-selfdrive",
    text: "Take the keys and drive yourself for a day, a week, or up to 30 days. Pick the car, set the dates, and collect it ready to go.",
    lead: "Sometimes the best driver is you. Selfdrive hands you the keys to a car from its owner, for a day or for up to 30 days.",
    points: ["Rent for up to 30 days.", "The owner lists the car and can switch it off when they need it back.", "Your payment is held in escrow, like every other job."],
    path: { Create: "Pick a car and the dates you need it.", Match: "The owner accepts, or you choose another car.", Work: "You drive it, for as long as you booked.", Handover: "A PIN closes the handover of the keys." },
    cost: "The price of a rental shows before you fund it. No figure is quoted here.",
    cta: { label: "Rent out your car", href: "/partners/selfdrive" },
    related: ["ride/cars", "ride/vip", "ride/move"],
    partnerLine: "Car owners list a car, and switch it off whenever they need it back.",
  }),
  S("ride", {
    key: "move", icon: Truck, title: "Move", photo: "sub-move",
    text: "Book a truck for the sofa, the shop stock, or the whole house. Say what is going and where, and a crew arrives ready to load it carefully.",
    lead: "A sofa will not fit on a boda, and a day's stock will not fit in a car. Move sends a truck, so the big things travel in one go.",
    points: ["A truck for furniture, stock, or a whole room.", "One driver, from your door to theirs.", "Same escrow, same PIN."],
    path: { Create: "Say what you are moving, and from where to where.", Work: "The driver loads up and drives it across." },
    cost: "You see the price before you fund it. No figure is quoted here.",
    cta: { label: "Bring your truck", href: "/partners/move" },
    related: ["ride/parcels", "ride/cars", "ride/selfdrive"],
  }),
  S("ride", {
    key: "parcels", feature: true, icon: Package, title: "Parcels", chip: "Parcel", photo: "sub-parcels", direct: true,
    text: "A delivery type, not a module. One rider across town. About 25 km or more, it changes hands: boda, taxi, then a last boda.",
    lead: "Parcels is a kind of delivery, not a module of its own. You pick it inside Ride, or send one from Buy. Across town, one rider carries your parcel. Further out, about 25 km or more, it changes hands from boda to taxi to a last boda, and the last rider still closes it with your PIN.",
    points: ["A delivery type you choose inside Ride, not a separate door.", "Across town: one rider, start to finish.", "About 25 km or more: boda, then taxi, then a last boda.", "A fuel station can be the drop and the pickup.", "The last rider closes it with a PIN."],
    path: { Create: "Say what you are sending, and to where.", Match: "A rider takes it. For a long trip, each leg is matched.", Work: "Across town it rides straight through. Far out, it changes hands between boda and taxi.", Handover: "The last rider closes it with the four-digit PIN." },
    cost: "You see the price before you fund it. No figure is quoted here.",
    cta: { label: "Carry parcels as a rider", href: "/partners/boda" },
    cta2: { label: "Carry parcels on your taxi", href: "/partners/taxi" },
    related: ["ride/boda", "buy/list", "ride/taxipress"],
    partnerLine: "Riders carry the parcels. A forecourt can also be a parcel drop and pickup.",
  }),
  S("ride", {
    key: "taxipress", icon: Bus, title: "TaxiPress", chip: "TaxiPress", photo: "sub-taxipress",
    text: "Buy a seat on a fixed taxi route straight from the stage queue. The line and your phone tell the same story, so you always know your place.",
    lead: "At the stage, the queue is the truth. TaxiPress sells a seat on a fixed route straight from that queue, so what you see on your phone is the same as what is in front of you.",
    points: ["A seat on a fixed route.", "Sold from the queue at the stage.", "The line and your phone tell the same story."],
    path: { Create: "Pick a route and a seat.", Match: "Your seat comes from the queue, in order.", Work: "You ride the route with the rest of the taxi." },
    cost: "You see the seat price before you fund it. No figure is quoted here.",
    cta: { label: "Bring your taxi", href: "/partners/taxi" },
    related: ["ride/rideshare", "ride/cars", "ride/parcels"],
    partnerLine: "Taxis sell seats on a fixed route from the queue at the stage. Commission is a percent or a flat fee.",
  }),
  S("ride", {
    key: "vip", icon: Crown, title: "VIP", chip: "VIP", tag: "Where available", photo: "sub-vip",
    text: "Ride in a premium car with a professional driver when the occasion calls for it. The option appears once an approved VIP car is on the road near you.",
    lead: "VIP is a premium car for the occasions that deserve one. It only shows once an approved car of that kind is on the road near you, so you never see an option that cannot arrive.",
    points: ["Appears only when an approved car is nearby.", "A premium car and driver.", "Escrow and PIN work as usual."],
    path: { Match: "Only approved premium cars can claim the trip." },
    cost: "You see the price before you fund it. No figure is quoted here.",
    cta: { label: "List a VIP car", href: "/partners/vip" },
    related: ["ride/cars", "ride/selfdrive", "ride/ambulance"],
  }),
  S("ride", {
    key: "ambulance", icon: Ambulance, title: "Ambulance", tag: "Where available", photo: "sub-ambulance",
    text: "If a life is in danger, call for help now. The ambulance option appears in the app once an approved ambulance is on the road near you, ready to respond.",
    lead: "If a life is in danger, call now. The ambulance option appears once an approved ambulance is on the road near you, and it is the one place Peebee puts a phone call ahead of the app.",
    points: ["Appears only when an approved ambulance is nearby.", "Life in danger? Call now rather than waiting on a screen."],
    cost: "No figure is quoted here.",
    cta: { label: "Join as an ambulance crew", href: "/partners/ambulance" },
    related: ["ride/vip", "ride/safety", "ride/boda"],
  }),
  S("ride", {
    key: "safety", feature: true, icon: ShieldCheck, title: "Verified riders, a live trip link", chip: "Safety", photo: "sub-safety",
    text: "Every rider is verified before they drive. Share a live trip link with someone waiting for you, and your fare sits in escrow until you give your PIN.",
    lead: "Every trip on Peebee runs on the same few promises. Riders are verified. You can share the trip live with someone who is waiting for you. And the fare waits in escrow, so it moves only after you give the rider your four-digit PIN.",
    points: ["Riders are verified before they can claim a trip.", "A live trip link for the person waiting for you.", "The fare sits in escrow until your PIN is given.", "Every movement of money is written twice."],
    path: { Fund: "The fare is held in escrow, not spent, until the ride is done." },
    cost: "No figure is quoted here.",
    cta: { label: "Become a rider", href: "/partners/boda" },
    related: ["ride/boda", "ride/cars", "ride/ambulance"],
  }),

  /* ───────────────── Buy ───────────────── */
  S("buy", {
    key: "list", icon: ClipboardList, title: "The list", chip: "List", photo: "sub-list",
    text: "Type your list or say it out loud, then set a budget cap. Your shopper confirms prices before buying anything, and you can repeat an old list in one tap.",
    lead: "Peebee began with the list. Write what you need, or say it out loud, and a verified rider walks the market for you. Set a cap on the budget, and the shopper confirms prices before anything is bought.",
    points: ["Type it or say it out loud.", "Set a budget cap. Prices are confirmed before anything is bought.", "Buy again from an earlier list in one tap.", "If something is out, the rider proposes a substitute and you approve it."],
    path: { Create: "Write or say your list, and set a budget cap.", Work: "The rider shops. You approve any substitute, and prices are confirmed before buying.", Handover: "The rider brings it, and you give the PIN." },
    cost: "You set the budget cap. No other figure is quoted here.",
    cta: { label: "Become a rider", href: "/partners/boda" },
    related: ["buy/substitutes", "buy/groceries", "buy/stores", "ride/parcels"],
    partnerLine: "Riders take the lists. Shops can take them too.",
  }),
  S("buy", {
    key: "groceries", icon: ShoppingBasket, title: "Groceries", photo: "sub-groceries",
    text: "Browse fresh produce and pantry shelves from markets and supermarkets near you. Fill a basket at your own pace, and a rider brings everything home to your door.",
    lead: "Browse the shelves, fill a basket, and let a rider carry it home. The shop packs what you chose, and you do not have to walk past the stalls to get it.",
    points: ["Browse shelves and fill a basket.", "A rider carries it home.", "If an item is out, you approve any substitute."],
    path: { Create: "Fill a basket from a shelf.", Work: "The shop packs it. A rider collects it." },
    cost: "Baskets start at UGX 5,000. That is a starting value and may have changed.",
    cta: { label: "Sell groceries", href: "/partners/grocery" },
    related: ["buy/list", "buy/stores", "buy/substitutes"],
    partnerLine: "Supermarkets and grocers join as shops. Shops start at 10% commission, a setting that may have changed.",
  }),
  S("buy", {
    key: "stores", icon: Store, title: "Stores", photo: "sub-stores",
    text: "Shop from stores open near you, from fashion and electronics to home goods. The store is paid only after your order reaches you, so you buy with confidence.",
    lead: "Shops open near you sit side by side: supermarkets, boutiques, electronics, butchers, hardware, bookshops and more. A shop is paid only after your order has reached you.",
    points: ["Twelve store types, from supermarkets to bookshops.", "A shop is paid only once your order reaches you.", "Pay from a shared link, even as a guest."],
    path: { Create: "Pick a shop and fill a basket.", Work: "The shop packs, a rider carries.", Settle: "Escrow pays the shop only after the order reaches you." },
    cost: "Baskets start at UGX 5,000. That is a starting value and may have changed.",
    cta: { label: "Open your store", href: "/partners/store" },
    related: ["buy/groceries", "buy/shared-links", "buy/spotlight", "buy/substitutes"],
    partnerLine: "Shops start at 10% commission. Pro and Elite plans exist, and fees are settings.",
  }),
  S("buy", {
    key: "pharmacy", icon: Pill, title: "Pharmacy", chip: "Pharma", photo: "sub-pharmacy", direct: true, /* a service: accordion row with Learn more */
    text: "Send a photo of the prescription. A licensed pharmacist quotes first, and you only pay if you accept.",
    lead: "Take a photo of the prescription and send it. A licensed pharmacy reads it, fills it from its own stock, and quotes you first. You only pay if you accept.",
    points: ["A photo of the prescription is all it takes.", "Only licensed pharmacies, licensed with the NDA, fill it.", "They quote first, and you pay only if you accept.", "A rider brings it, and you give the PIN."],
    path: { Create: "Photograph the prescription and send it.", Match: "A licensed pharmacy picks it up and quotes you.", Fund: "If you accept the quote, the money is held in escrow.", Work: "The pharmacy fills it from its own stock." },
    cost: "What a prescription costs is not settled yet, so nothing is quoted here.",
    cta: { label: "List your pharmacy", href: "/partners/pharmacy" },
    related: ["buy/stores", "buy/list", "ride/parcels"],
    partnerLine: "Pharmacies have an inbox for prescriptions and a stock list. The licence sits with the NDA.",
  }),
  S("buy", {
    key: "spotlight", feature: true, icon: Flame, title: "Spotlight", chip: "Spotlight", photo: "sub-spotlight", direct: true,
    text: "Short video from the market: what is fresh, what just landed, who has it. Watch live now, catch the replays, and add what you like to the basket.",
    lead: "Spotlight is short video from the market floor: what is fresh, what just landed, who has it right now. Watch live, catch the replays, and add what you like to the basket. It lives inside Buy, so it is not a door of its own.",
    points: ["Watch live from the market, or catch the replays.", "See what is fresh and who has it.", "Add what you like straight to the basket.", "Shops put their own stall on screen."],
    path: { Create: "Watch a video, and tap what you want.", Work: "The shop packs it. A rider carries it." },
    cost: "No figure is quoted here. You see the price of each item before you fund.",
    cta: { label: "Sell on Spotlight", href: "/partners/store" },
    related: ["buy/stores", "buy/groceries", "buy/shared-links"],
    partnerLine: "Shops show their own stall in front of people who are about to shop.",
  }),
  S("buy", {
    key: "shared-links", feature: true, icon: Link2, title: "Shared links", chip: "Links", photo: "sub-shared-links",
    text: "When a friend sends you a product link, you can pay for it straight from that link, even as a guest. No account setup stands between you and checkout.",
    lead: "A friend sends you a link to something in a shop. Open it, and pay straight from that page. You do not need an account to pay as a guest.",
    points: ["Open a product link and pay from it.", "A guest can pay without signing up.", "The shop is paid only after the order reaches you."],
    path: { Create: "Open the link and choose what you want.", Fund: "Pay from the link, held in escrow." },
    cost: "You see the price on the link before you pay.",
    cta: { label: "Open your store", href: "/partners/store" },
    related: ["buy/stores", "buy/substitutes", "buy/list"],
  }),
  S("buy", {
    key: "substitutes", feature: true, icon: Replace, title: "Substitutes", photo: "sub-substitutes",
    text: "If an item is out of stock, your rider suggests a replacement with a photo and price. Nothing is swapped into your order until you approve it yourself.",
    lead: "Shelves run out. When an item is gone, the rider suggests a replacement and sends it to you. Nothing swaps in until you approve it.",
    points: ["The rider proposes a replacement, with a message to you.", "You approve it, or say no thanks.", "Nothing changes in your order without you."],
    path: { Work: "The rider finds an item is out and proposes a replacement.", Handover: "Only what you approved comes through the door." },
    cost: "No figure is quoted here.",
    cta: { label: "Sell with Peebee", href: "/partners/store" },
    related: ["buy/list", "buy/groceries", "buy/stores"],
    partnerLine: "When an item is out, the rider proposes a replacement. Nothing swaps in until the buyer approves it.",
  }),

  /* ───────────────── Eat ───────────────── */
  S("eat", {
    key: "restaurants", icon: UtensilsCrossed, title: "Restaurants", photo: "sub-restaurants",
    text: "Order from full menus at the best restaurants and caf\u00e9s near you. Track your meal from the kitchen to your door, and it arrives fresh and well packed.",
    lead: "Full menus from restaurants near you, with the usual question answered up front: what is on, and who is cooking. Order, and the chat sits on the order itself.",
    points: ["Full menus from restaurants near you.", "Chat with the kitchen on the order.", "Each kitchen keeps its own cart."],
    path: { Create: "Pick a restaurant and put dishes in its cart.", Work: "The kitchen cooks it.", Handover: "The rider brings it. You give the PIN." },
    cost: "You see every price before you fund. No figure is quoted here.",
    cta: { label: "List your restaurant", href: "/partners/restaurant" },
    related: ["eat/home-kitchens", "eat/chat", "eat/carts"],
    partnerLine: "Menus, prices and opening times stay in the restaurant's hands.",
  }),
  S("eat", {
    key: "home-kitchens", icon: CookingPot, title: "Home kitchens", chip: "Kitchens", photo: "sub-home-kitchens",
    text: "Order a plate of someone's good home cooking, made fresh in a clean, approved kitchen near you. It's the comfort of a home-cooked meal without the effort.",
    lead: "Somebody on your road cooks very well, and now you can order it by the plate. A home kitchen is small, personal, and often the best meal of the week.",
    points: ["Home cooking, ordered by the plate.", "Chat with the cook on the order.", "Each kitchen has its own cart."],
    path: { Create: "Pick a kitchen and a plate.", Work: "The cook makes it." },
    cost: "You see the price before you fund. No figure is quoted here.",
    cta: { label: "Cook from home", href: "/partners/home-kitchen" },
    related: ["eat/restaurants", "eat/street-food", "eat/chat"],
    partnerLine: "A small kitchen is enough. Cook what you cook best.",
  }),
  S("eat", {
    key: "street-food", icon: ChefHat, title: "Street food", photo: "sub-street-food",
    text: "Rolex, chapati and other favourites, cooked fresh by smart, uniformed vendors at clean stalls. It arrives hot off the pan, wrapped neatly and ready to enjoy.",
    lead: "Rolex and chapati, hot off the pan, from the stall with the best queue on your road. Order it ahead and a rider carries it over.",
    points: ["Rolex, chapati and the rest.", "Order ahead from the stall.", "Chat on the order if you want it your way."],
    path: { Create: "Pick a stall and order.", Work: "They cook it fresh while the rider heads over." },
    cost: "You see the price before you fund. No figure is quoted here.",
    cta: { label: "Sell your street food", href: "/partners/street-food" },
    related: ["eat/restaurants", "eat/juices", "eat/bakeries"],
    partnerLine: "Rolex, chapati and the rest, from the stall already running.",
  }),
  S("eat", {
    key: "juices", icon: Citrus, title: "Juice and smoothies", chip: "Juices", photo: "sub-juices",
    text: "Fresh juices and smoothies blended to order while your rider is on the way. Pick your fruits, choose your size, and enjoy it cold and freshly made.",
    lead: "Cold, fresh, and made while the rider is on the way. Juice counters and smoothie bars sell by the cup, and you can chat if you want it sweeter or not.",
    points: ["Juice and smoothies by the cup.", "Made while you wait for the rider.", "Chat on the order for the little changes."],
    path: { Work: "The counter blends it as the rider arrives." },
    cost: "You see the price before you fund. No figure is quoted here.",
    cta: { label: "Open your juice counter", href: "/partners/juice" },
    related: ["eat/street-food", "eat/bakeries", "eat/restaurants"],
    partnerLine: "Counters that sell by the cup.",
  }),
  S("eat", {
    key: "bakeries", icon: Croissant, title: "Bakeries", photo: "sub-bakeries",
    text: "Fresh bread, buns, pastries and celebration cakes from bakeries down the road. Order for breakfast, a meeting, or a birthday, and it arrives soft and fresh.",
    lead: "Bread, buns and cake from the oven down the road. Order ahead for the morning, or for the party at the weekend.",
    points: ["Bread, buns and cakes.", "Order ahead.", "Chat with the bakery on the order."],
    path: { Create: "Pick a bakery and what you want.", Work: "They bake it, and a rider carries it." },
    cost: "You see the price before you fund. No figure is quoted here.",
    cta: { label: "Sell your bakes", href: "/partners/bakery" },
    related: ["eat/juices", "eat/restaurants", "eat/home-kitchens"],
    partnerLine: "Bread, buns and cakes, ordered ahead.",
  }),
  S("eat", {
    key: "chat", feature: true, icon: MessageCircle, title: "Chat on the order", chip: "Chat", photo: "sub-chat",
    text: "Ask the kitchen about the chilli, or tell your rider which gate to use. Every message stays on the order, so nothing gets lost between you and them.",
    lead: "Ask about the chilli, or tell the rider which gate. The chat sits on the order itself, so the kitchen, the rider and you are all reading the same thread, and nothing gets lost.",
    points: ["One thread per order, with the kitchen and the rider.", "Voice notes work too.", "Nothing is lost when the order ends. It stays on the order."],
    path: { Work: "Ask the kitchen a question, or tell the rider about the gate." },
    cost: "No figure is quoted here.",
    cta: { label: "Start selling food", href: "/partners/restaurant" },
    related: ["eat/restaurants", "eat/carts", "eat/home-kitchens"],
    partnerLine: "Answer a question about the chilli without leaving the order.",
  }),
  S("eat", {
    key: "carts", feature: true, icon: ShoppingCart, title: "Unified cart", chip: "Cart", photo: "sub-carts",
    text: "Add dishes from different restaurants and items from different shops to one cart, then check out once. Each seller still prepares their part, and you track each one as it moves.",
    lead: "One cart for the whole order. Mix dishes from different restaurants with items from different shops, and check out once.",
    points: ["Dishes from several restaurants in one cart.", "Shop items alongside them.", "One checkout, one payment from your wallet."],
    path: { Create: "Add dishes and items from any seller to one cart.", Fund: "Check out once; the payment is held in escrow." },
    cost: "No figure is quoted here.",
    cta: { label: "Start selling food", href: "/partners/restaurant" },
    related: ["eat/restaurants", "eat/chat", "buy/list"],
  }),

  /* ───────────────── Learn ───────────────── */
  S("learn", {
    key: "my-class", icon: GraduationCap, title: "My Class", chip: "My Class", photo: "sub-my-class",
    text: "See all your courses, your progress and the certificates you've earned in one place. Pick up exactly where you left off, on your phone or your laptop.",
    lead: "My Class is where your learning lives: the courses you have joined, how far you have got, and the certificates you have earned along the way.",
    points: ["Your courses and your progress.", "Quizzes, exams and assignments.", "Certificates at the end."],
    path: { Create: "Join a course.", Fund: "The course fee is held in escrow until the work is done.", Work: "Lessons, quizzes and assignments, in your own time.", Handover: "A code from your account opens the lessons on Peebee TV." },
    cost: "Each course shows its fee. No figure is quoted here.",
    cta: { label: "Teach on Peebee", href: "/partners/teacher" },
    related: ["learn/discover", "learn/live", "learn/tv"],
    partnerLine: "Commission starts at 10%. It is a setting and may have changed.",
  }),
  S("learn", {
    key: "live", icon: Radio, title: "Live", photo: "sub-live",
    text: "Join a cohort, sit a quiz, or raise your hand in a live online class. Have a class code from your tutor? Type it in and you're in the room.",
    lead: "Join a cohort, sit a quiz, put a hand up in the live room. If your tutor gave you a class code, type it in and you are in.",
    points: ["Live rooms for the sessions that need a voice.", "Type in a class code from your tutor.", "Quizzes in the room."],
    path: { Create: "Type in the class code, or pick a live class.", Work: "Join the live room and take part." },
    cost: "Each class shows its fee. No figure is quoted here.",
    cta: { label: "Teach live", href: "/partners/teacher" },
    related: ["learn/my-class", "learn/connect", "learn/discover"],
    partnerLine: "A live room for the sessions that need a voice.",
  }),
  S("learn", {
    key: "tv", icon: Tv, title: "Peebee TV", chip: "TV", photo: "sub-tv",
    text: "Watch the same lessons on your television, and learn together as a family on the big screen. A code from your account is all it takes to connect.",
    lead: "The same lessons open on the television, so the whole room can watch together. A code from your account is all it asks for.",
    points: ["The same lessons, on a bigger screen.", "A code from your account opens it.", "Your progress stays with you."],
    path: { Handover: "Type the code from your account on the television." },
    cost: "No figure is quoted here.",
    cta: { label: "Put your lessons on TV", href: "/partners/teacher" },
    related: ["learn/my-class", "learn/live", "learn/discover"],
    partnerLine: "Lessons open on Peebee TV with a code from the learner's account.",
  }),
  S("learn", {
    key: "discover", feature: true, icon: Compass, title: "Discover", photo: "sub-discover",
    text: "Search courses, schools and subjects, then pick the level that suits you. Not sure yet? Try a practice class that plays by itself before you commit.",
    lead: "Search courses, schools or subjects, then pick a level. If you are not sure yet, try a practice class that plays by itself.",
    points: ["Search by course, school or subject.", "Pick a level: Sprouts, Foundations, Academy, Compass or Skills.", "A practice class that plays by itself."],
    path: { Create: "Search, then pick a level and a course." },
    cost: "No figure is quoted here.",
    cta: { label: "Bring your school", href: "/partners/school" },
    related: ["learn/my-class", "learn/sprouts", "learn/skills"],
  }),
  S("learn", {
    key: "connect", feature: true, icon: MessagesSquare, title: "Connect", photo: "sub-connect",
    text: "Talk lessons through with your classmates and tutors, course by course. Ask questions, share notes and get help whenever a topic needs more than one explanation.",
    lead: "Talk lessons through with classmates and tutors, course by course. A question asked in the room often gets answered by someone who has just been there.",
    points: ["A room for each course.", "Classmates and tutors, together.", "Keep the lesson talk out of your other chats."],
    cost: "No figure is quoted here.",
    cta: { label: "Teach on Peebee", href: "/partners/teacher" },
    related: ["learn/live", "learn/my-class", "learn/discover"],
  }),
  S("learn", {
    key: "sprouts", icon: Sprout, title: "Sprouts", tag: "3–6", photo: "sub-sprouts",
    text: "Playful lessons, songs and stories for children aged 3 to 6. Your little one builds early reading, numbers and curiosity through short, joyful sessions at home.",
    lead: "Sprouts is for ages 3 to 6: play, stories and first letters, in short sessions that fit small attention spans.",
    points: ["Ages 3 to 6.", "Play and stories.", "Runs school, class, course, module, lesson like every stream."],
    cost: "No figure is quoted here.",
    cta: { label: "Teach on Peebee", href: "/partners/teacher" },
    related: ["learn/foundations", "learn/discover", "learn/tv"],
  }),
  S("learn", {
    key: "foundations", icon: Backpack, title: "Foundations", tag: "Primary", photo: "sub-foundations",
    text: "Lessons that follow the primary school years, with clear explanations and practice quizzes. Your child revises at their own pace and you can follow their progress.",
    lead: "Foundations is primary school: reading, number and the habits of a good learner, from first term to last.",
    points: ["Primary school.", "Quizzes, assignments and a gradebook.", "Certificates at the end."],
    cost: "No figure is quoted here.",
    cta: { label: "Bring your school", href: "/partners/school" },
    related: ["learn/sprouts", "learn/academy", "learn/discover"],
  }),
  S("learn", {
    key: "academy", icon: GraduationCap, title: "Academy", tag: "Secondary", photo: "sub-academy",
    text: "Secondary school courses taught by experienced teachers, with live classes, revision and exam practice. Study on your phone, laptop or TV, wherever you learn best.",
    lead: "Academy is secondary school, with the exams, the assignments and the gradebook that go with it.",
    points: ["Secondary school.", "Exams, quizzes and assignments.", "A gradebook and certificates."],
    cost: "No figure is quoted here.",
    cta: { label: "Bring your school", href: "/partners/school" },
    related: ["learn/foundations", "learn/compass", "learn/live"],
  }),
  S("learn", {
    key: "compass", icon: Compass, title: "Compass", tag: "University", photo: "sub-compass",
    text: "University courses and study support, from first-year modules to final exams. Join live sessions, review recordings, and learn alongside students in Uganda and beyond.",
    lead: "Compass is university: longer courses, deeper modules, and certificates at the end.",
    points: ["University.", "Courses and modules.", "Certificates at the end."],
    cost: "No figure is quoted here.",
    cta: { label: "Teach on Peebee", href: "/partners/teacher" },
    related: ["learn/academy", "learn/skills", "learn/live"],
  }),
  S("learn", {
    key: "skills", icon: Hammer, title: "Skills", tag: "Work", photo: "sub-skills",
    text: "Practical courses for work, from digital skills to business and trades. Learn something you can use straight away, and earn a certificate to show employers.",
    lead: "Skills is practical learning for work: the course that gets you from knowing to doing.",
    points: ["Practical courses for work.", "Learn at your own pace.", "A certificate at the end."],
    cost: "No figure is quoted here.",
    cta: { label: "Teach a skill", href: "/partners/teacher" },
    related: ["learn/compass", "learn/discover", "work/workers"],
  }),

  /* ───────────────── Work ───────────────── */
  S("hive", {
    key: "clean", icon: Sparkles, title: "Clean", photo: "sub-clean",
    text: "Book a professional cleaner for your home or office. Choose a catalogue price for regular cleaning, or ask for a quote when the job is bigger.",
    lead: "A tidy home, without the chasing. A cleaning job shows a catalogue price, or you ask for a quote when the job is harder to size up from a distance.",
    points: ["A catalogue price, or a quote for the big job.", "Say what needs doing and when.", "Choose how it is matched."],
    path: { Create: "Say what needs cleaning and when.", Match: "A cleaner claims it, the nearest takes it, or you pick the person.", Handover: "When you are happy, give the PIN." },
    cost: "A catalogue price or a quote shows before you fund. No figure is quoted here.",
    cta: { label: "Get work", href: "/partners/cleaner" },
    related: ["work/laundry", "work/fix", "work/matching"],
    partnerLine: "Home services start at 15% commission. It is a setting and may have changed.",
  }),
  S("hive", {
    key: "laundry", icon: WashingMachine, title: "Laundry", photo: "sub-laundry",
    text: "Your clothes are collected, machine washed, ironed and brought back folded. Name your own price, and add a tip when the service earns one.",
    lead: "Wash, dry and fold, picked up and brought back. For laundry you can name your own price, and add a tip if the work earns one.",
    points: ["Name your own price.", "Add a tip if the work earns one.", "Picked up and brought back."],
    path: { Create: "Say what needs washing and name your price.", Work: "It is washed, dried and folded." },
    cost: "You name the price. No figure is quoted here.",
    cta: { label: "Start earning", href: "/partners/laundry" },
    related: ["work/clean", "work/fix", "work/matching"],
    partnerLine: "Laundry can take the buyer's own price, and a tip on top.",
  }),
  S("hive", {
    key: "fix", icon: Wrench, title: "Fix", photo: "sub-fix",
    text: "Get plumbing, electrics, appliances and repairs handled by a skilled professional. Catalogue prices apply where they exist, and you get a quote where they don't.",
    lead: "A door that will not close, a tap that will not stop. Fix shows catalogue prices where they exist, and a quote where they do not.",
    points: ["Catalogue prices where they exist.", "A quote where they do not.", "Pay when the work is done."],
    path: { Create: "Say what is broken, with a photo if you can.", Work: "It is fixed, priced the way it was agreed." },
    cost: "A catalogue price or a quote shows before you fund. No figure is quoted here.",
    cta: { label: "Get work", href: "/partners/fixer" },
    related: ["work/clean", "work/workers", "work/matching"],
    partnerLine: "Fix what is broken, priced the way you price it.",
  }),
  S("hive", {
    key: "workers", icon: HardHat, title: "Workers", photo: "sub-workers",
    text: "Need a hand with the odd job that doesn't fit anywhere else? Describe the task, and a reliable, verified worker near you takes it on.",
    lead: "Workers is the odd job: the thing that does not fit anywhere else on the list. Say what needs doing and find a person to do it.",
    points: ["The odd job that fits nowhere else.", "Find a person for a quick job.", "Matched the same three ways."],
    path: { Create: "Say what the odd job is.", Match: "A worker claims it, the nearest takes it, or you pick the person." },
    cost: "No figure is quoted here.",
    cta: { label: "Find work", href: "/partners/worker", note: "Not open yet" },
    related: ["work/hire", "work/matching", "work/fix"],
  }),
  S("hive", {
    key: "hire", icon: Briefcase, title: "Hire", tag: "Off for now", photo: "sub-hire",
    text: "Find the right person for a longer project or ongoing role. Hiring stays switched off for now and will open in the app when it's ready.",
    lead: "Hire is for a person on a longer project. It is built, and it stays off until it is switched on. When it is, the same door will say Work and Hire in turn, because they are two features on the same thing.",
    points: ["A person for a longer project.", "Off for now, and it stays off until it is switched on.", "Talent, the partner side, has not opened."],
    cost: "No figure is quoted here.",
    cta: { label: "Hire someone", href: "/partners/talent", note: "Not open yet" },
    related: ["work/workers", "work/matching", "work/clean"],
  }),
  S("hive", {
    key: "matching", feature: true, icon: Handshake, title: "How should we find someone?", chip: "Matching", photo: "sub-matching",
    text: "Say what needs doing and when. Then choose how you're matched: the first to claim, the nearest within a time window, or the person you pick.",
    lead: "Say what needs doing and when. Then choose how it is matched: first to claim, nearest in a time window, or you pick the person.",
    points: ["First to claim.", "Nearest inside a time window.", "You pick the person."],
    path: { Match: "The way you chose decides who gets the job." },
    cost: "No figure is quoted here.",
    cta: { label: "Get work", href: "/partners#work" },
    related: ["work/clean", "work/workers", "ride/boda"],
  }),
];

export const SUB_BY_ID = Object.fromEntries(SUBS.map((s) => [`${s.door}/${s.key}`, s])) as Record<string, Sub>;
export const servicesOf = (door: DoorId) => SUBS.filter((s) => s.door === door && !s.feature);
export const featuresOf = (door: DoorId) => SUBS.filter((s) => s.door === door && s.feature);
export const subsOf = (door: DoorId) => SUBS.filter((s) => s.door === door);
