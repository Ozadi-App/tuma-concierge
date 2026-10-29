/**
 * One page per partner type. Every fact here comes from the Peebee app repo
 * (PROJECT.md, PEEBEE_CAR_DESIGN.md, work-engine.md, the Taxipress migrations)
 * or from figures already on this site. Money figures are starting values that
 * Peebee can change in settings. Where the app does not settle something yet,
 * the copy says so or leaves it out.
 */
import {
  Bike, CarFront, KeyRound, Users, Truck, Bus, Crown, Ambulance, Store, ShoppingBasket, Pill,
  UtensilsCrossed, ChefHat, Flame, CupSoda, Croissant, GraduationCap, School, Sparkles, Shirt, Wrench,
  HardHat, BriefcaseBusiness, type LucideIcon,
} from "lucide-react";

export type PartnerDoor = "ride" | "buy" | "eat" | "learn" | "work";

export type PSection = { id: string; title: string; text: string; points?: string[] };
export type PFigure = { label: string; value: string; note?: string };
export type PFaq = { q: string; a: string };

export type PartnerType = {
  slug: string;
  door: PartnerDoor;
  name: string;
  /** a short label for buttons and lists */
  short: string;
  icon: LucideIcon;
  photo: string;
  who: string;
  headline: string;
  lead: string;
  app: { name: string; url: string } | null;
  closed?: boolean;
  steps: string[];
  figures?: PFigure[];
  sections: PSection[];
  faqs: PFaq[];
  related: string[];
};

export const PARTNER_DOORS: { id: PartnerDoor; title: string; line: string }[] = [
  { id: "ride", title: "Ride", line: "Bikes, cars, taxis and trucks." },
  { id: "buy", title: "Buy", line: "Stores, market stalls and pharmacies." },
  { id: "eat", title: "Eat", line: "Kitchens of every size." },
  { id: "learn", title: "Learn", line: "Teachers and schools." },
  { id: "work", title: "Work", line: "Hands for hire, near home." },
];

const ph = (k: string) => `/photos/sub-${k}.webp`;
const RIDER = { name: "Peebee Rider", url: "https://rider.peebee.online" };
const CAR = { name: "Peebee Car", url: "https://car.peebee.online" };
const KITCHEN = { name: "Peebee Restaurant", url: "https://restaurant.peebee.online" };
const MERCHANT = { name: "Peebee Merchant", url: "https://merchant.peebee.online" };
const PHARM = { name: "Peebee Pharmacy", url: "https://pharmacy.peebee.online" };
const LEARN = { name: "Peebee Learn", url: "https://learn.peebee.online" };
const WORK = { name: "Peebee Work", url: "https://work.peebee.online" };

/* shared paragraphs, worded once so every page says the same true thing */
const ESCROW = "The customer pays before the work starts. Peebee holds that money. When the job is handed over, the customer reads you a PIN, you enter it, and the money is released to your wallet.";
const WALLET_OUT = "Your earnings sit in your Peebee wallet. Withdraw to MTN or Airtel mobile money whenever you like.";
const CAR_OUT = "Your share is credited to your wallet in Peebee Car, with cash-out to mobile money once Peebee switches withdrawals on.";
const WALLET_IN = "Your earnings go to your Peebee wallet.";
const MATCH_MODES = "Peebee sets how a job is offered in your area: first to claim it, the nearest partner within a short window, or the customer choosing from those who respond.";
const CAR_SHARE: PFigure[] = [
  { label: "Car fare", value: "UGX 2,000 / km", note: "Minimum UGX 8,000" },
  { label: "Owner share", value: "60%" },
  { label: "Driver share", value: "30%" },
  { label: "Peebee", value: "10%" },
];
const CAR_DOCS = ["National ID", "Driving licence (drivers)", "Logbook, insurance and inspection (vehicles)"];
const SHOP_FIGS: PFigure[] = [
  { label: "To start", value: "10%", note: "Commission per sale, no monthly fee" },
  { label: "Pro", value: "UGX 35,000 / month", note: "UGX 75,000 with live selling" },
  { label: "Elite", value: "UGX 150,000 / month", note: "5% commission" },
];
const KITCHEN_PAY = `${ESCROW} Settle your balance to MTN or Airtel Mobile Money from the Wallet screen.`;
const WORK_FIG: PFigure[] = [{ label: "Peebee commission", value: "15%", note: "Starting value" }];
const WORK_PAY: PSection = {
  id: "pay", title: "How you get paid",
  text: "The customer pays into escrow when they book. When you finish, they confirm. If they say nothing, the job confirms itself after 24 hours and you are paid. A customer who is unhappy has 48 hours to raise it, and Peebee looks at both sides before money moves.",
  points: ["Peebee keeps its commission, the rest goes to your Peebee wallet", "A late cancellation by the customer pays you a share"],
};
const WORK_SIGNUP: PSection = {
  id: "signup", title: "Signing up",
  text: "Apply in Peebee Work as yourself or as a company. A company adds its staff and sends them to jobs. Peebee approves every provider before the first job reaches them.",
};
const WORK_CASH: PSection = {
  id: "cash", title: "Cash and ratings",
  text: "Payment goes through the app, not your pocket. The on-site steps are built to keep it that way, because the escrow is what protects you if a customer disputes. After each job the customer rates you, and good ratings bring more work.",
};

export const PARTNER_TYPES: PartnerType[] = [
  /* ───────────── RIDE ───────────── */
  {
    slug: "boda", door: "ride", name: "Boda riders", short: "Boda rider", icon: Bike, photo: ph("boda"),
    who: "Rides, parcels and shopping runs on your bike.",
    headline: "Your bike. Your hours. Every job closed with a PIN.",
    lead: "As a Peebee rider you carry people, deliver parcels and run shopping lists for customers nearby. You choose when you are online, and you see what a job pays before you take it.",
    app: RIDER,
    steps: ["Download Peebee Rider and sign up with your phone", "Scan your national ID", "Peebee checks it and switches you on", "Go online and take your first job"],
    figures: [{ label: "Fuel vouchers", value: "Up to UGX 60,000 a day", note: "Starting cap per rider" }],
    sections: [
      { id: "signup", title: "Signing up", text: "You sign up in the Rider app, then scan your national ID. A person at Peebee checks it. Until you are verified you can look around, but you cannot take jobs." },
      { id: "jobs", title: "What reaches you", text: "Three kinds of work arrive in one list.", points: ["Rides: a customer who needs to get somewhere on a boda", "Parcels: pick up, carry, hand over. Long parcels can travel in legs, boda to taxi to boda", "Shopping: you buy from a list, send substitutes for the customer to approve, and deliver"] },
      { id: "match", title: "How you are matched", text: `${MATCH_MODES} Where Peebee allows it, you can offer a different fee and the customer decides.` },
      { id: "pay", title: "How you get paid", text: `${ESCROW} ${WALLET_OUT}` },
      { id: "cash", title: "Cash", text: "Some customers pay in cash on rides. The app tells you how each job is paid before you start, so there are no surprises at the end." },
      { id: "extras", title: "What else you get", text: "Fuel vouchers you redeem at partner fuel stations, and savings circles you can run with riders from your stage. Cancellation and no-show fees are set by Peebee and shown in the app." },
      { id: "safety", title: "Ratings and safety", text: "Every job ends with a rating. Customers and riders can chat and call inside the app, and the PIN means a parcel only leaves your hands for the right person." },
    ],
    faqs: [
      { q: "Do I need my own bike?", a: "You need a bike you can ride for work. Peebee does not lend bikes." },
      { q: "Can I deliver parcels without doing rides?", a: "Parcels, rides and shopping arrive in the same list. You take the jobs you want." },
      { q: "Is there a monthly fee?", a: "A rider subscription exists in the app but is switched off today." },
    ],
    related: ["taxi", "driver"],
  },
  {
    slug: "driver", door: "ride", name: "Car drivers", short: "Car driver", icon: CarFront, photo: ph("cars"),
    who: "Drive an approved car and earn a share of each fare.",
    headline: "You drive. The car is ready. The fare is split before you start.",
    lead: "No car? You can still earn. Peebee pairs approved drivers with approved cars, and every fare is split between the owner, you and Peebee at a set share.",
    app: CAR,
    steps: ["Sign up in Peebee Car and choose Driver", "Upload your ID and driving licence", "Peebee approves you and assigns you a car", "Go online and take rides"],
    figures: CAR_SHARE,
    sections: [
      { id: "signup", title: "Signing up", text: "In the Peebee Car app you choose Driver mode. You upload your ID and licence, and Peebee approves you before any ride reaches you." },
      { id: "car", title: "Which car you drive", text: "Car owners list their cars and Peebee managers assign drivers to them. If you own a car and drive it yourself, you can be both owner and driver." },
      { id: "jobs", title: "How rides reach you", text: "Ride now jobs reach drivers nearby. Scheduled rides open to drivers a short time before pickup. Where bidding is on, you send a price and the customer picks." },
      { id: "pay", title: "How you get paid", text: `Every fare is split at the shares Peebee sets. Today they start at 60% to the owner, 30% to you and 10% to Peebee. ${CAR_OUT}` },
      { id: "nav", title: "On the road", text: "Navigation opens in your phone's own maps app. The customer can see where you are and reach you by chat or call." },
      { id: "safety", title: "Ratings and safety", text: "Customers rate every ride. Cancellation and no-show fees are set by Peebee and shown to you before you accept." },
    ],
    faqs: [
      { q: "Can I drive my own car?", a: "Yes. Register as an owner, list the car, and register as a driver too." },
      { q: "Who sets the fare?", a: "Peebee sets the fare by distance, from UGX 2,000 per km with a UGX 8,000 minimum. Bids are only used where bidding is on." },
    ],
    related: ["car-owner", "rideshare"],
  },
  {
    slug: "car-owner", door: "ride", name: "Car owners", short: "Car owner", icon: KeyRound, photo: ph("cars"),
    who: "Put your car to work while someone else drives.",
    headline: "Your car earns. You do not have to drive it.",
    lead: "List your car with Peebee, and approved drivers take rides in it. You keep the largest share of every fare and can see your car's trips as they happen.",
    app: CAR,
    steps: ["Sign up in Peebee Car and choose Owner", "Add your car with its logbook, insurance and inspection", "Peebee approves the car and assigns a driver", "Watch the rides and the earnings come in"],
    figures: CAR_SHARE,
    sections: [
      { id: "signup", title: "Signing up", text: "In the Peebee Car app you choose Owner mode and add each car: plate, make, model, colour and photos, with the logbook, insurance and inspection. Peebee approves a car before it can take a ride." },
      { id: "drivers", title: "Drivers", text: "Peebee managers assign approved drivers to approved cars. If you want to drive it yourself, register as a driver as well." },
      { id: "pay", title: "How you get paid", text: `Each fare is split at the shares Peebee sets, starting at 60% for you, 30% for the driver and 10% for Peebee. ${CAR_OUT}` },
      { id: "control", title: "Staying in control", text: "You can see each car's rides, and take a car off the road whenever you choose." },
      { id: "other", title: "Other ways your car can earn", text: "The same car can be listed for self-drive rentals or used for rideshare trips. Each has its own page." },
    ],
    faqs: [
      { q: "Do I choose the driver?", a: "Peebee managers assign approved drivers. Talk to Peebee if you have someone in mind; they must be approved first." },
      { q: "Can I list more than one car?", a: "Yes. Each car is approved on its own." },
    ],
    related: ["driver", "selfdrive", "rideshare"],
  },
  {
    slug: "rideshare", door: "ride", name: "Rideshare drivers", short: "Rideshare", icon: Users, photo: ph("rideshare"),
    who: "Already driving somewhere? Sell the empty seats.",
    headline: "You were going anyway. Fill the empty seats.",
    lead: "This is for you if you have a car and do not want to run taxi rides. You publish a trip you are already making, set the seats, and passengers going your way book them.",
    app: CAR,
    steps: ["Sign up in Peebee Car and get approved", "Publish a trip: from, to, time and seats", "Passengers book seats", "Drive, check each passenger in, get paid"],
    sections: [
      { id: "signup", title: "Signing up", text: "You register in the Peebee Car app with your ID, licence and car documents. Peebee approves you and the car before you can publish a trip." },
      { id: "trips", title: "How it works", text: "You publish a single trip, or one that repeats each week, such as your drive to work. Customers going the same way see it and book a seat. You never have to accept a ride you were not making." },
      { id: "seats", title: "Seats and passengers", text: "Each seat booking is its own order, with its own payment, chat and rating. You see who is coming before you leave." },
      { id: "pay", title: "How you get paid", text: `Passengers pay when they book. Peebee holds it, and the money is released to your wallet when the trip is done. ${CAR_OUT}` },
      { id: "safety", title: "Ratings and safety", text: "Passengers are Peebee customers with accounts, and they rate the trip. You can chat or call them in the app." },
    ],
    faqs: [
      { q: "Do I have to take on-demand rides?", a: "No. Rideshare is only the trips you publish." },
      { q: "Can I repeat a trip every week?", a: "Yes, within the limit Peebee sets." },
    ],
    related: ["driver", "car-owner"],
  },
  {
    slug: "selfdrive", door: "ride", name: "Self-drive owners", short: "Self-drive", icon: KeyRound, photo: ph("selfdrive"),
    who: "Rent out your car, with a deposit held for you.",
    headline: "Rent out your car. The deposit is held before the keys move.",
    lead: "Customers rent your car and drive it themselves, for up to 30 days. Peebee holds the rent and a deposit from the renter's wallet before the rental starts.",
    app: CAR,
    steps: ["List your car in Peebee Car", "Peebee approves it for self-drive", "A renter books and pays rent plus deposit", "Hand over the keys, get them back, get paid"],
    figures: [{ label: "Longest rental", value: "30 days" }],
    sections: [
      { id: "signup", title: "Signing up", text: "You list the car in Owner mode with its logbook, insurance and inspection. Peebee approves it before it can be rented." },
      { id: "hold", title: "Rent and deposit", text: "The renter pays the rent and a deposit from their Peebee wallet before the rental starts. Peebee holds both." },
      { id: "return", title: "When the car comes back", text: "The rent is released to you. The deposit goes back to the renter unless you claim damage. If you do, Peebee looks at the claim and decides." },
      { id: "licence", title: "The renter's licence", text: "The renter's driving licence is recorded on the booking. Peebee does not verify it with the licensing authority, so look at it at handover." },
      { id: "pay", title: "How you get paid", text: CAR_OUT },
    ],
    faqs: [
      { q: "Is self-drive open everywhere?", a: "Peebee switches self-drive on where it is ready. If you do not see it in the app, it is not open in your area yet." },
      { q: "What if the car is damaged?", a: "Claim against the deposit before it is returned. Peebee rules on the claim." },
    ],
    related: ["car-owner", "rideshare"],
  },
  {
    slug: "move", door: "ride", name: "Movers and trucks", short: "Move / truck", icon: Truck, photo: ph("move"),
    who: "Vans, pickups and trucks for moving loads.",
    headline: "Your truck, booked by the load.",
    lead: "Customers moving house, stock or furniture book a cargo vehicle by size. If you own or drive one, Peebee brings the bookings to you.",
    app: CAR,
    steps: ["Sign up in Peebee Car", "Add your vehicle under its cargo category", "Peebee approves it", "Take moves"],
    sections: [
      { id: "signup", title: "Signing up", text: "Register in the Peebee Car app with your ID, licence and the vehicle's logbook, insurance and inspection. You add it under the cargo category that fits its size." },
      { id: "jobs", title: "How moves reach you", text: "Customers choose a vehicle size, then the pickup and drop-off. The booking goes to approved vehicles in that category." },
      { id: "price", title: "Pricing", text: "Each cargo category has its own fare, set by Peebee and shown before you accept." },
      { id: "pay", title: "How you get paid", text: `${ESCROW} ${CAR_OUT}` },
      { id: "safety", title: "Ratings", text: "The customer rates every move. Chat and calls stay inside the app." },
    ],
    faqs: [{ q: "Do I need a crew?", a: "That is between you and the customer. Say what you include when you chat." }],
    related: ["car-owner", "driver"],
  },
  {
    slug: "taxi", door: "ride", name: "Taxi drivers (TaxiPress)", short: "Taxi", icon: Bus, photo: ph("taxipress"),
    who: "Matatus on a route, seats booked in the app.",
    headline: "Your taxi joins the line. The seats sell themselves.",
    lead: "TaxiPress puts your matatu on its route in Peebee. Passengers book seats in the app while you still sell seats at the stage the way you always have.",
    app: CAR,
    steps: ["Register your taxi in Peebee Car under TaxiPress", "Peebee approves it on one route", "Join the line at your stage", "Board, depart, arrive"],
    sections: [
      { id: "signup", title: "Signing up", text: "You register your taxi with its plate and seat layout, 14 or 18 seats, on one route. Peebee approves it. One approval covers two switches: carrying passengers, and carrying parcels." },
      { id: "line", title: "How the line works", text: "When you join the line, you queue behind the taxis ahead of you. When you reach the front you are Boarding Now, and only one taxi on a route boards at a time. Then you are on the road, then arrived." },
      { id: "seats", title: "App seats and stage seats", text: "Seats sold in the app are counted for you. Seats you sell to walk-up passengers at the stage are added by you, so the app always knows how full you are." },
      { id: "parcels", title: "Parcels", text: "If parcels are switched on, your taxi can carry a leg of a relay parcel between stages, handed over by boda riders at each end." },
      { id: "pay", title: "How you get paid", text: `Each seat booked in the app is a paid order. Peebee keeps a commission set per route, either a percentage or a flat fee. ${CAR_OUT}` },
      { id: "cancel", title: "Cancellations and no-shows", text: "When a booked passenger cancels or does not show, the app records what they get back and any fee kept, once per booking." },
    ],
    faqs: [
      { q: "Do I stop selling seats at the stage?", a: "No. Keep selling and add those seats in the app." },
      { q: "Can I change route?", a: "Your taxi is approved on one route. Ask Peebee to move it." },
    ],
    related: ["boda", "driver"],
  },
  {
    slug: "vip", door: "ride", name: "VIP and luxury cars", short: "VIP car", icon: Crown, photo: ph("vip"),
    who: "Premium cars for weddings, events and long days.",
    headline: "A premium car, booked by the hour.",
    lead: "Luxury bookings are for the customer who wants the car for a wedding, an event or a whole day. Fares combine distance with an hourly rate.",
    app: CAR,
    steps: ["List your car in Peebee Car", "Peebee approves it as Luxury", "Customers book now or for later", "Drive the booking, get paid"],
    sections: [
      { id: "signup", title: "Signing up", text: "You list the car like any other, with documents and photos. Peebee approves it into the Luxury category. Luxury only appears to customers once Peebee has approved at least one car." },
      { id: "jobs", title: "How bookings reach you", text: "Customers book for now or for later and say how many hours they need, up to a full day, with a note about the occasion." },
      { id: "price", title: "Pricing", text: "The fare is distance plus an hourly rate, both set by Peebee and shown before you accept." },
      { id: "pay", title: "How you get paid", text: `The fare is split between owner, driver and Peebee at the set shares. ${CAR_OUT}` },
    ],
    faqs: [{ q: "Can I drive it myself?", a: "Yes, register as owner and driver." }],
    related: ["car-owner", "driver"],
  },
  {
    slug: "ambulance", door: "ride", name: "Ambulance crews", short: "Ambulance", icon: Ambulance, photo: ph("ambulance"),
    who: "Be the nearest crew when it matters.",
    headline: "When someone needs you now, you are the nearest crew.",
    lead: "Ambulance bookings are always immediate and always go to the nearest free crew. The customer sees an emergency notice telling them to call emergency services first.",
    app: CAR,
    steps: ["Register the vehicle in Peebee Car", "Peebee approves it as Ambulance", "Stay online", "Respond, transport, get paid"],
    sections: [
      { id: "signup", title: "Signing up", text: "Register in the Peebee Car app with the vehicle documents and driver licence, under the Ambulance category. Peebee approves it like any vehicle. Your medical licensing and equipment remain your responsibility; Peebee does not inspect them." },
      { id: "jobs", title: "How calls reach you", text: "There is no booking ahead. Each request goes to the nearest free crew, with the customer's note about what is happening." },
      { id: "pay", title: "How you get paid", text: `The trip is paid in the app and released to your wallet when it closes. ${CAR_OUT}` },
    ],
    faqs: [{ q: "Is Peebee an emergency service?", a: "No. Customers are told to call emergency services first. Peebee helps them reach a crew nearby." }],
    related: ["driver"],
  },

  /* ───────────── BUY ───────────── */
  {
    slug: "store", door: "buy", name: "Stores and shops", short: "Store", icon: Store, photo: ph("stores"),
    who: "Your shop, on every phone in town.",
    headline: "Open your shop to every phone in town.",
    lead: "Peebee Merchant runs your shop online: stock, staff, outlets and payouts. Riders shop and deliver for your customers, and you pick the plan that fits your size.",
    app: MERCHANT,
    steps: ["Sign up in Peebee Merchant", "Pass the business checks", "Add outlets, staff and stock", "Take orders"],
    figures: SHOP_FIGS,
    sections: [
      { id: "signup", title: "Signing up", text: "You apply in Peebee Merchant and pass Peebee's business checks. Then you add your outlets, each with its own code, and your staff. Cashiers only see the outlet they work at." },
      { id: "orders", title: "How orders reach you", text: "Customers order from your listing. Riders who are shopping for a customer pay you at the counter using your outlet code. If an item is out, they offer a substitute, and the customer approves it." },
      { id: "spotlight", title: "Selling with video", text: "Spotlight lets you sell with short videos, and live selling is on the Pro plan with live." },
      { id: "plans", title: "Plans", text: "Start on commission only. Move to Pro or Elite when the monthly fee costs less than the commission. Customer baskets start from UGX 5,000." },
      { id: "pay", title: "How you get paid", text: `Your sales settle into your merchant balance. Settle your balance to a verified MTN or Airtel Mobile Money number from the Wallet screen.` },
    ],
    faqs: [
      { q: "Do I need a website?", a: "No. Your Peebee listing is your shop online." },
      { q: "What kinds of shops?", a: "17 categories." },
    ],
    related: ["grocery", "pharmacy"],
  },
  {
    slug: "grocery", door: "buy", name: "Grocery and market sellers", short: "Grocery seller", icon: ShoppingBasket, photo: ph("groceries"),
    who: "Fresh food from your stall to a doorstep.",
    headline: "Your stall, your prices, a doorstep across town.",
    lead: "Customers send shopping lists, and Peebee riders buy from sellers like you. Listing in Peebee Merchant puts your stall where those riders and customers can find it.",
    app: MERCHANT,
    steps: ["Sign up in Peebee Merchant", "Choose the groceries store type", "Add what you sell", "Serve riders and customers"],
    figures: SHOP_FIGS,
    sections: [
      { id: "signup", title: "Signing up", text: "Apply in Peebee Merchant, pass the business checks, and set up your outlet with its code." },
      { id: "orders", title: "How orders reach you", text: "A rider arrives with a customer's list and pays at your counter with your outlet code. When something is finished, the rider sends a substitute for the customer to approve." },
      { id: "plans", title: "Plans", text: "The same plans as every store. Start on commission and change when it suits you." },
      { id: "pay", title: "How you get paid", text: `Sales settle into your merchant balance. Settle your balance to a verified MTN or Airtel Mobile Money number from the Wallet screen.` },
    ],
    faqs: [{ q: "I have no shop, only a stall. Can I join?", a: "If you sell regularly from one place, set it up as an outlet. Peebee checks every business before it goes live." }],
    related: ["store", "boda"],
  },
  {
    slug: "pharmacy", door: "buy", name: "Pharmacies", short: "Pharmacy", icon: Pill, photo: ph("pharmacy"),
    who: "Licensed pharmacies, with their own app.",
    headline: "Prescriptions in, medicine out, all of it on record.",
    lead: "Peebee Pharmacy gives licensed pharmacies an inbox for orders and a place to keep stock. Customers order, you prepare, a rider delivers.",
    app: PHARM,
    steps: ["Sign up in Peebee Pharmacy", "Upload your licence", "Load your stock", "Answer orders"],
    sections: [
      { id: "signup", title: "Signing up", text: "Only licensed pharmacies can join. You show your licence from the National Drug Authority, and Peebee checks it." },
      { id: "orders", title: "How orders reach you", text: "Orders arrive in your inbox. You confirm what you can supply from your stock list, and a rider collects." },
      { id: "pay", title: "How you get paid", text: `${ESCROW} Settle your balance to a verified MTN or Airtel Mobile Money number from the Wallet screen.` },
    ],
    faqs: [{ q: "What does it cost?", a: "Peebee will confirm pricing with you when you sign up." }],
    related: ["store"],
  },

  /* ───────────── EAT ───────────── */
  ...([
    ["restaurant", "Restaurants", "Restaurant", UtensilsCrossed, "restaurants", "Your menu, delivered hot.", "Your kitchen, on every phone nearby.", "Put your full menu in Peebee Restaurant, with photos and prices. Orders arrive, you cook, a rider collects, and you are paid when the food is handed over.", "A full menu, sections, photos and your logo."],
    ["home-kitchen", "Home kitchens", "Home kitchen", ChefHat, "home-kitchens", "Cook from home, sell to the neighbourhood.", "Cook what you are known for. From home.", "You do not need a restaurant to sell food on Peebee. Cook from your own kitchen, list what you make, and riders take it to customers nearby.", "A short menu of what you cook best, and the hours you cook."],
    ["street-food", "Street food vendors", "Street food", Flame, "street-food", "Rolex, chips, chapati, from your grill.", "Your grill has a queue. Now it has a phone too.", "List your stand in Peebee Restaurant. Customers order from their phones, a rider picks up from your spot, and the money arrives when the food does.", "Your stand's few best items, priced the way you sell them."],
    ["juice", "Juice bars", "Juice bar", CupSoda, "juices", "Fresh juice, smoothies and cold drinks.", "Fresh juice, poured for someone across town.", "List your juices and smoothies in Peebee Restaurant. Orders come in, you pour and seal, and a rider gets it there cold.", "Juices, sizes and combos with photos."],
    ["bakery", "Bakeries", "Bakery", Croissant, "bakeries", "Bread, cakes and pastries, ordered ahead.", "Your bakes, on breakfast tables you will never see.", "List your bread, cakes and pastries in Peebee Restaurant. Customers order, you pack, a rider delivers while it is still fresh.", "Daily bakes and cakes, with what is available today."],
  ] as const).map(([slug, name, short, icon, photo, who, headline, lead, menu]): PartnerType => ({
    slug, door: "eat", name, short, icon, photo: ph(photo), who, headline, lead, app: KITCHEN,
    steps: ["Sign up in Peebee Restaurant", "Peebee approves your kitchen", "Build your menu", "Take orders"],
    sections: [
      { id: "signup", title: "Signing up", text: "You apply in the Peebee Restaurant app. Your kitchen waits in pending approval until Peebee checks it, then goes live." },
      { id: "menu", title: "Your menu", text: `${menu} You change prices and switch items off whenever you need to.` },
      { id: "orders", title: "How orders reach you", text: "Orders land in the app with everything the customer asked for. You can chat with the customer. When it is ready, a Peebee rider collects it." },
      { id: "pay", title: "How you get paid", text: KITCHEN_PAY },
      { id: "fees", title: "Fees", text: "Peebee's fee is shown in the app before you go live." },
      { id: "ratings", title: "Ratings", text: "Customers rate each order. Good ratings move you up when people browse." },
    ],
    faqs: [
      { q: "Do I need my own delivery riders?", a: "No. Peebee riders collect from you." },
      { q: "When do I get paid?", a: "When the rider hands over the food and the customer's PIN is entered." },
    ],
    related: ["restaurant", "home-kitchen", "street-food", "juice", "bakery"].filter((s) => s !== slug).slice(0, 3),
  })),

  /* ───────────── LEARN ───────────── */
  {
    slug: "teacher", door: "learn", name: "Tutors and teachers", short: "Teacher", icon: GraduationCap, photo: ph("academy"),
    who: "Teach courses and live classes.",
    headline: "Teach once. Get paid every time someone learns.",
    lead: "Peebee Learn gives you courses, live classrooms, quizzes and certificates in one place. You set the price, and Peebee takes a small share.",
    app: LEARN,
    steps: ["Sign up in Peebee Learn", "Build a course or schedule a live class", "Set your price", "Teach and get paid"],
    figures: [{ label: "Peebee commission", value: "10%", note: "Starting value" }],
    sections: [
      { id: "build", title: "What you build", text: "Courses are made of modules and lessons, with quizzes and exams. Learners who finish can earn a certificate." },
      { id: "live", title: "Teaching live", text: "Run live classrooms and streams for a cohort, and put lessons on Peebee TV." },
      { id: "price", title: "Pricing", text: "You set the price. Coupons and bundles help you fill a class." },
      { id: "pay", title: "How you get paid", text: `Learners pay in the app. Peebee keeps its commission and the rest is yours. ${WALLET_IN}` },
    ],
    faqs: [{ q: "Can I teach for a school too?", a: "Yes. Schools have their own page." }],
    related: ["school"],
  },
  {
    slug: "school", door: "learn", name: "Schools and institutions", short: "School", icon: School, photo: ph("skills"),
    who: "Classes, fees and passes for your whole school.",
    headline: "Your school, online, with the fees collected for you.",
    lead: "Set up your school in Peebee Learn with classes, teachers, courses and a gradebook. Collect tuition in the app and offer school passes.",
    app: LEARN,
    steps: ["Create your school in Peebee Learn", "Add classes and teachers", "Load courses", "Enrol learners and collect fees"],
    figures: [{ label: "Peebee commission", value: "10%", note: "Starting value" }],
    sections: [
      { id: "setup", title: "Setting up", text: "A school holds classes, and each class holds courses, modules and lessons. Teachers run them, and the gradebook keeps the marks." },
      { id: "fees", title: "Fees and passes", text: "Collect tuition fees in the app, or sell a school pass that opens many courses at once." },
      { id: "live", title: "Live teaching", text: "Live classrooms and streams work for whole classes, and lessons can go out on Peebee TV." },
      { id: "pay", title: "How you get paid", text: `Payments come in through the app, minus Peebee's commission. ${WALLET_IN}` },
    ],
    faqs: [{ q: "Can parents pay?", a: "Anyone with a Peebee account can pay for a learner." }],
    related: ["teacher"],
  },

  /* ───────────── WORK ───────────── */
  {
    slug: "cleaner", door: "work", name: "Cleaners", short: "Cleaner", icon: Sparkles, photo: ph("clean"),
    who: "Homes and offices, booked and paid in the app.",
    headline: "Clean homes. Get paid without chasing anyone.",
    lead: "Clean is the first Peebee Work service. Customers book a clean, you or your team do it, and the money is held from the moment they book.",
    app: WORK, figures: WORK_FIG,
    steps: ["Apply in Peebee Work", "Get approved", "Take bookings", "Get paid after the job"],
    sections: [
      WORK_SIGNUP,
      { id: "jobs", title: "How jobs reach you", text: "Depending on the service, a booking goes out to providers nearby, the customer picks who they want, or Peebee assigns it." },
      { id: "price", title: "Pricing", text: "Most cleans are booked from a fixed list of services. Bigger jobs can be quoted." },
      WORK_PAY, WORK_CASH,
    ],
    faqs: [{ q: "Can I bring my team?", a: "Yes. Register as a company and add your staff." }],
    related: ["laundry", "fixer"],
  },
  {
    slug: "laundry", door: "work", name: "Laundry", short: "Laundry", icon: Shirt, photo: ph("laundry"),
    who: "Washing and ironing, collected and returned.",
    headline: "Wash, iron, return. Paid every time.",
    lead: "Customers book laundry in Peebee. You do the washing, and payment is held from the moment they book.",
    app: WORK, figures: WORK_FIG,
    steps: ["Apply in Peebee Work", "Get approved", "Take bookings", "Get paid after the job"],
    sections: [
      WORK_SIGNUP,
      { id: "jobs", title: "How jobs reach you", text: "Bookings go out to approved laundry providers nearby, or the customer chooses you directly." },
      { id: "price", title: "Pricing", text: "Laundry is priced from a fixed list of services, shown to the customer before they book." },
      WORK_PAY, WORK_CASH,
    ],
    faqs: [{ q: "Do I collect the clothes?", a: "Collection and return are arranged on the booking." }],
    related: ["cleaner", "fixer"],
  },
  {
    slug: "fixer", door: "work", name: "Fixers and technicians", short: "Fixer", icon: Wrench, photo: ph("fix"),
    who: "Plumbing, electrics, repairs. Quote and get paid.",
    headline: "You fix it. Your call-out fee is already held.",
    lead: "Customers book repairs through Peebee Fix. For jobs that need a look first, your call-out fee is held before you set off, and you quote from there.",
    app: WORK, figures: WORK_FIG,
    steps: ["Apply in Peebee Work", "Get approved", "Take bookings or send quotes", "Get paid after the job"],
    sections: [
      WORK_SIGNUP,
      { id: "jobs", title: "How jobs reach you", text: "A job goes out to fixers nearby, the customer picks from those who respond, or Peebee assigns it." },
      { id: "price", title: "Pricing", text: "Simple jobs have a fixed price. For everything else you quote after looking, and the call-out fee is held when the customer books so the trip is never wasted." },
      WORK_PAY, WORK_CASH,
    ],
    faqs: [{ q: "What if the customer turns down my quote?", a: "The call-out fee was held for exactly that." }],
    related: ["cleaner", "worker"],
  },
  {
    slug: "worker", door: "work", name: "General workers", short: "Worker", icon: HardHat, photo: ph("workers"),
    who: "Casual and odd jobs near you.", closed: true,
    headline: "Casual work near you. Opening soon.",
    lead: "Find work for anyone with a Peebee account, including riders and partners who want a side income. It is built and waiting to be switched on.",
    app: null,
    steps: ["Keep your Peebee account ready", "Watch for Find work in the app"],
    sections: [
      { id: "how", title: "How it will work", text: "You will keep a worker profile, set your availability and apply for jobs posted near you. Payment is planned through escrow, like the rest of Peebee." },
    ],
    faqs: [{ q: "When does it open?", a: "Peebee has not set a date." }],
    related: ["talent", "cleaner"],
  },
  {
    slug: "talent", door: "work", name: "Hire and talent", short: "Hire", icon: BriefcaseBusiness, photo: ph("hire"),
    who: "Freelancers and professionals. Not open yet.", closed: true,
    headline: "Peebee Hire. Not open yet.",
    lead: "Peebee Hire is for freelancers and professionals: a profile that works as a CV, bids on work and payment held until the job is done. It is built and switched off for now.",
    app: null,
    steps: ["Keep your Peebee account ready", "Watch for Hire in the app"],
    sections: [
      { id: "how", title: "How it will work", text: "Employers post work, you apply or bid, and payment is protected. Peebee screens out unlawful work." },
    ],
    faqs: [{ q: "When does it open?", a: "Peebee has not set a date." }],
    related: ["worker"],
  },
];

export const PARTNER_TYPE_BY_SLUG: Record<string, PartnerType> = Object.fromEntries(PARTNER_TYPES.map((p) => [p.slug, p]));

/** Old partner pages and #anchors, mapped to their dedicated page. */
export const LEGACY_PARTNERS: Record<string, { to: string; hash?: Record<string, string> }> = {
  rides: { to: "/partners#ride", hash: { boda: "boda", owners: "car-owner", drivers: "driver", taxipress: "taxi", fuel: "boda", relay: "taxi", rideshare: "rideshare", selfdrive: "selfdrive", move: "move", vip: "vip", ambulance: "ambulance" } },
  food: { to: "/partners#eat", hash: { restaurants: "restaurant", kitchens: "home-kitchen", street: "street-food", juice: "juice", bakeries: "bakery" } },
  shops: { to: "/partners/store", hash: { "store-types": "store", spotlight: "store", substitutes: "store", groceries: "grocery" } },
  home: { to: "/partners#work", hash: { clean: "cleaner", repair: "fixer", laundry: "laundry" } },
  learn: { to: "/partners#learn", hash: { courses: "teacher", live: "teacher", tv: "teacher", schools: "school" } },
};

/** cards on the landing page */
export const FEATURED_PARTNERS = ["boda", "driver", "taxi", "restaurant", "store", "teacher", "cleaner"];
