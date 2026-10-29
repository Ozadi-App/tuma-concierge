/**
 * Questions per partner type. Every answer is drawn from the Peebee app repo
 * (API settings defaults, work-engine.md, PEEBEE_CAR_DESIGN.md,
 * MERCHANT_PAYMENTS_PLAN.md and the partner apps). Figures are starting values
 * Peebee can change in settings. Where something is not built or not known,
 * the question is left out.
 */
export type PQ = { q: string; a: string };

const SUPPORT: PQ = { q: "How do I reach Peebee if something goes wrong?", a: "Email support@peebee.online. For a problem on a job, report it from that job in the app so the details travel with it." };
const ONE_ACCOUNT: PQ = { q: "Can I use the same Peebee account I shop with?", a: "Yes. Partner roles sit on an ordinary Peebee account, so one login can be a customer and a partner." };
const PRACTICE: PQ = { q: "Can I try the app before I start for real?", a: "Yes. Every Peebee app has a practice mode with sample data, where no real money moves." };
const DEVICE = (app: string): PQ => ({ q: "What do I need to run it?", a: `A smartphone with internet. ${app} runs in the phone's browser and can be installed to your home screen like an app.` });
const RULES_CHANGE: PQ = { q: "Are these figures fixed?", a: "No. Fees, shares and time limits are Peebee settings and can change. The app always shows the current figure before it applies to you." };

/* ── Rider (boda) ── */
const RIDER_PAY: PQ[] = [
  { q: "When do I get paid?", a: "When the job is handed over. The customer reads you their 4-digit PIN, you enter it, and the money held for the job is released to your rider wallet." },
  { q: "Why does the customer pay before I start?", a: "The customer pays into escrow, so the money is already held while you work. You never deliver hoping to be paid." },
  { q: "Can I withdraw my earnings?", a: "Yes. Withdraw from your rider wallet to a saved mobile money number, either the full balance or an amount you choose." },
  { q: "How many mobile money numbers can I save?", a: "Up to two withdrawal numbers. With two saved, you pick which one each withdrawal goes to." },
  { q: "Does anything have to stay in my wallet?", a: "Peebee can set a small minimum balance that stays behind. If it is on, the wallet shows the amount." },
  { q: "What happens on cash jobs?", a: "The customer pays you directly and Peebee's fee for that job is recorded against your wallet. It is taken from your next in-app payout automatically." },
];

/* ── Car family ── */
const CAR_SIGN: PQ[] = [
  { q: "How do I sign up?", a: "Apply in the Peebee Car app at car.peebee.online and choose Owner, Driver or both. Peebee reviews you before any booking reaches you." },
  { q: "What documents do I need?", a: "Your national ID. Drivers add a driving licence with its expiry date. Each vehicle needs its logbook, insurance and inspection." },
];
const CAR_DEVICE = DEVICE("Peebee Car");
const CAR_SHARE_Q: PQ = { q: "How is the fare split?", a: "At shares Peebee sets, starting at 60% to the owner, 30% to the driver and 10% to Peebee. The split is applied when the booking completes." };
const CAR_MONEY: PQ[] = [
  { q: "When do I get paid?", a: "When the booking completes, your share is credited to your wallet in Peebee Car." },
  { q: "Can I withdraw my earnings?", a: "Cash-out to mobile money is built into the Peebee Car wallet and opens when Peebee switches withdrawals on. Any minimum amount is shown there." },
];
const CAR_TRIP: PQ[] = [
  { q: "Can the customer see where I am?", a: "Yes. The customer follows you on a live map and can chat or call you in the app." },
  { q: "Are there ratings?", a: "Yes. Customers rate every completed booking." },
];

/* ── Merchant settlement (stores, restaurants) ── */
const SETTLE: PQ[] = [
  { q: "Where does my money go?", a: "Into your merchant balance in the app. Each sale shows as pending or available, with a full history of sales, holds and settlements." },
  { q: "How do I cash out?", a: "Settle your available balance to a Mobile Money destination, MTN or Airtel, from the Wallet screen." },
  { q: "Why can't I settle to a new number straight away?", a: "Every new payout destination is verified by Peebee and then waits a 24-hour security cooling period before money can go to it." },
  { q: "Instant or scheduled settlement?", a: "Both are offered. Instant settlement can carry a fee, and the app shows the fee and exactly what you receive before you confirm." },
  { q: "Can settlements be paused?", a: "Yes, Peebee can briefly pause merchant withdrawals while it reconciles balances. Your balance is not affected." },
];
const COUNTER: PQ[] = [
  { q: "How does a rider pay me?", a: "Each outlet has its own payment code and QR. The rider scans or enters it with the amount, and you get the confirmation from Peebee directly, never from the rider's screen." },
  { q: "What if the amount is wrong?", a: "Do not confirm a different amount. Both you and the rider must agree on the exact amount, so ask the rider to correct the request first." },
  { q: "What if there is a disagreement after a sale?", a: "Report it and explain what differs. Peebee keeps the evidence for review." },
];
const MERCH_STAFF: PQ = { q: "Can my staff use it?", a: "Yes. Owners add staff with roles: cashiers confirm sales at their outlet, managers run outlets, and finance roles see balances and settle. Only owners manage staff." };
const MERCH_BRANCH: PQ = { q: "I have more than one branch. Is that supported?", a: "Yes. Add each location as an outlet, and each gets its own rider payment code." };
const PLANS: PQ[] = [
  { q: "What does it cost?", a: "You can start on 10% commission per sale with no monthly fee. Pro is UGX 35,000 a month (UGX 75,000 with live selling) and Elite is UGX 150,000 a month at 5% commission." },
  { q: "Is there a minimum order?", a: "Customer baskets start from UGX 5,000." },
];

/* ── Restaurant family ── */
const EAT_BASE = (kind: string, menuQ: PQ): PQ[] => [
  { q: "How do I sign up?", a: `Apply in Peebee Restaurant at restaurant.peebee.online and choose the kind of food business you run. Your ${kind} stays in pending approval until Peebee checks it, then goes live.` },
  DEVICE("Peebee Restaurant"),
  menuQ,
  { q: "Can I switch items off when they run out?", a: "Yes. Change prices or switch items off at any time, and customers only see what is on." },
  { q: "Can I set my hours?", a: "Yes. Add scheduled hours so customers know when you are open." },
  { q: "How do orders reach me?", a: "They land in the app with everything the customer asked for. You get a notification, and you can chat with the customer about the order." },
  { q: "Do I need my own delivery riders?", a: "No. When the order is ready a Peebee rider collects it and delivers it." },
  { q: "When do I get paid?", a: "The customer pays before you cook. Peebee holds it, and it is released when the rider hands the order over and the customer's PIN is entered." },
  { q: "What does Peebee charge?", a: "Peebee's fee is shown in the app before you go live." },
  { q: "Is my wallet ready straight away?", a: "Your payout wallet runs on Peebee Merchant. If the wallet says your restaurant is not yet connected, Peebee connects it for you." },
  ...SETTLE.slice(1, 4),
  { q: "Do ratings matter?", a: "Yes. Customers rate each order." },
  ONE_ACCOUNT, SUPPORT,
];

/* ── Work family ── */
const WORK_BASE: PQ[] = [
  { q: "How do I sign up?", a: "Apply in Peebee Work at work.peebee.online as an individual or as a company. Peebee approves every provider before they can go online or take jobs." },
  DEVICE("Peebee Work"),
  { q: "Can I bring my team?", a: "Yes, register as a company and add staff by phone number or email. Staff sign in with their own account and only see jobs you assign them. Payouts always go to you." },
  { q: "How do jobs reach me?", a: "Peebee sets this per area. Jobs are sent to providers nearby and the first to accept wins, or you send an offer and the customer picks, or Peebee assigns the job." },
  { q: "How far away will I get jobs from?", a: "Jobs go to providers within a set radius of the customer, starting at 15 km." },
  { q: "Is the money really there before I go?", a: "Yes. A booking only exists once the customer's money is held. Fixed-price jobs hold the full price; quoted jobs hold the call-out fee." },
  { q: "What does Peebee charge?", a: "A commission that starts at 15% of the job. A service can have its own rate, and the commission is fixed on the job when it is booked." },
  { q: "When do I get paid?", a: "When the customer confirms the job is done. If they say nothing, the job confirms itself after 24 hours and you are paid." },
  { q: "Where does the money go?", a: "Into your Peebee wallet, minus Peebee's commission. Your Earnings screen lists every payout." },
  { q: "What if the customer cancels late?", a: "If a customer cancels more than 10 minutes after you are on the job, you receive a share of the price, starting at 20%." },
  { q: "What if I cancel?", a: "The job goes back out to other providers and you cannot take it again." },
  { q: "What if the customer reports a problem?", a: "They have 48 hours after completion. The money stays held while Peebee looks at both sides, then releases it to you, refunds it, or splits it." },
  { q: "Can I chat with the customer and share photos?", a: "Yes. Chat opens once you are on the job, and you can add before and after photos. The customer sees your location while the job is booked or in progress." },
  { q: "Can I take cash instead?", a: "No. Jobs are paid through the app, and the held money is what protects you if a customer disputes." },
  { q: "Are there ratings?", a: "Yes. The customer rates you after each job, and good ratings bring more work." },
  SUPPORT,
];

export const PARTNER_QUESTIONS: Record<string, PQ[]> = {
  boda: [
    { q: "How do I sign up?", a: "Sign up in the Peebee Rider app at rider.peebee.online with your phone, then scan your national ID." },
    DEVICE("Peebee Rider"),
    { q: "When can I start taking jobs?", a: "Once a person at Peebee has checked your ID and verified you. Until then you can look around but cannot take jobs." },
    { q: "Do I need my own bike?", a: "Yes. Peebee does not lend bikes." },
    { q: "What kinds of jobs will I get?", a: "Rides, parcels and shopping runs, all in one list. You take the ones you want." },
    { q: "How are jobs matched to me?", a: "Peebee sets it per area: first rider to claim, the nearest rider within a short window, or the customer choosing from riders who apply." },
    { q: "Can I ask for a different price?", a: "Where Peebee allows it, yes. You propose your fee within limits Peebee sets, and the customer accepts or declines." },
    { q: "How does a shopping job work?", a: "The customer's money is held first. You buy from the list, send substitutes for anything missing, the customer approves, and you deliver." },
    { q: "How do I pay shops on a shopping job?", a: "At participating shops you can pay with the shop's outlet code from the order's budget, so you don't carry the customer's cash." },
    { q: "Can I deliver long-distance parcels?", a: "Yes. Long parcels can travel as a relay: one rider to a taxi, the taxi between stages, and a last rider to the door." },
    ...RIDER_PAY,
    { q: "Are there waiting and cancellation fees?", a: "Yes. Peebee sets them, and the app shows them on the job." },
    { q: "What are fuel vouchers?", a: "Vouchers you redeem at partner fuel stations, up to a cap Peebee sets, starting at UGX 60,000 a day." },
    { q: "What are savings circles?", a: "Group savings you can run with riders from your stage. They are cash-first, and every money step is confirmed by an officer of the circle." },
    { q: "Is there a monthly fee?", a: "A rider subscription exists in the app but is switched off today." },
    { q: "Can I go offline?", a: "Yes. You choose when you are online, and jobs only reach you while you are." },
    SUPPORT,
  ],
  driver: [
    ...CAR_SIGN.slice(0, 2),
    CAR_DEVICE,
    { q: "I don't own a car. Can I still drive?", a: "Yes. Peebee managers assign approved drivers to approved cars listed by owners." },
    { q: "Can I drive my own car?", a: "Yes. Register as both owner and driver, and list the car." },
    { q: "How do rides reach me?", a: "Ride-now requests go to drivers nearby. Scheduled rides open to drivers a short time before pickup, starting at 60 minutes." },
    { q: "Who sets the fare?", a: "Peebee sets it by distance, starting at UGX 2,000 per km with a UGX 8,000 minimum." },
    { q: "Can I bid a different price?", a: "Only where Peebee has switched bidding on. You send a price within the allowed range and the customer picks." },
    CAR_SHARE_Q, ...CAR_MONEY,
    { q: "How do I navigate?", a: "Navigation opens in your phone's own maps app." },
    { q: "What about cancellations and no-shows?", a: "Peebee sets any cancellation and no-show fees, and they are shown before you accept." },
    ...CAR_TRIP, RULES_CHANGE, SUPPORT,
  ],
  "car-owner": [
    ...CAR_SIGN.slice(0, 2),
    CAR_DEVICE,
    { q: "What do I add for each car?", a: "Plate, make, model, colour and photos, with the logbook, insurance and inspection. Each car is approved on its own." },
    { q: "Can I list more than one car?", a: "Yes. Every car goes through approval separately." },
    { q: "Do I choose the driver?", a: "Peebee managers assign approved drivers to approved cars. Anyone you have in mind must register and be approved first." },
    { q: "Can I drive it myself?", a: "Yes. Register as a driver as well as an owner." },
    CAR_SHARE_Q, ...CAR_MONEY,
    { q: "Can I see what my car is doing?", a: "Yes. Each car's bookings show in the app." },
    { q: "Can I take the car off the road?", a: "Yes, whenever you choose." },
    { q: "What else can the car earn from?", a: "The same car can be listed for self-drive rentals or rideshare trips where Peebee has those open." },
    RULES_CHANGE, SUPPORT,
  ],
  rideshare: [
    { q: "Who is rideshare for?", a: "Drivers already making a trip who want to sell the empty seats, without doing on-demand rides." },
    ...CAR_SIGN.slice(0, 2),
    { q: "How do I offer seats?", a: "Publish a trip with where from, where to, the time and how many seats." },
    { q: "Can I repeat a trip every week?", a: "Yes, a trip can repeat weekly, up to a limit Peebee sets." },
    { q: "Do I have to take on-demand rides?", a: "No. Rideshare is only the trips you publish." },
    { q: "How do passengers book?", a: "Customers going the same way see your trip and book seats. Each booking is its own order with its own payment, chat and rating." },
    { q: "When do passengers pay?", a: "When they book. Peebee holds the money until the trip is done." },
    { q: "When do I get paid?", a: "When the trip is done, the money is released to your wallet in Peebee Car." },
    CAR_MONEY[1],
    { q: "Will I know who is coming?", a: "Yes. You see your booked passengers before you leave, and can chat or call them in the app." },
    ...CAR_TRIP.slice(1), SUPPORT,
  ],
  selfdrive: [
    { q: "How does self-drive work?", a: "Customers rent your car and drive it themselves, for up to 30 days." },
    { q: "How do I list my car?", a: "Add it in Owner mode with its logbook, insurance and inspection. Peebee approves it before it can be rented." },
    { q: "Is self-drive open everywhere?", a: "No. Peebee switches it on where it is ready. If you don't see it in the app, it isn't open in your area yet." },
    { q: "How is the renter charged?", a: "The rent and a deposit are taken from the renter's Peebee wallet before the rental starts, and Peebee holds both." },
    { q: "When do I get paid?", a: "When the rental ends, the rent is released to you." },
    { q: "What happens to the deposit?", a: "It goes back to the renter unless you claim damage. If you claim, Peebee looks at it and decides how much you receive." },
    { q: "Does Peebee check the renter's licence?", a: "The licence is recorded on the booking but not verified with the licensing authority, so check it at handover." },
    { q: "Should I take photos at handover?", a: "Yes. Inspection photos are not built into the app yet, so take your own when the car leaves and returns." },
    { q: "Is there a late-return fee?", a: "Not in the app yet. Agree return times clearly with the renter." },
    CAR_MONEY[1], SUPPORT,
  ],
  move: [
    ...CAR_SIGN.slice(0, 2),
    { q: "Which vehicles can join?", a: "Vans, pickups and trucks. You add yours under the cargo category that fits its size." },
    { q: "How do moves reach me?", a: "Customers choose a vehicle size and enter pickup and drop-off. The booking goes to approved vehicles in that category." },
    { q: "How is a move priced?", a: "Each cargo category has its own fare set by Peebee, shown before you accept." },
    { q: "When do I get paid?", a: "The customer pays before the move. Peebee holds it and releases it to your wallet when the move is handed over." },
    CAR_MONEY[1],
    { q: "Do I need to bring a crew?", a: "That is between you and the customer. Say what you include when you chat." },
    ...CAR_TRIP, SUPPORT,
  ],
  taxi: [
    { q: "How do I register my taxi?", a: "In Peebee Car under TaxiPress, with the plate and seat layout, 14 or 18 seats, on one route. Peebee approves it." },
    { q: "Can I carry parcels as well?", a: "Approval covers two switches, passengers and parcels. With parcels on, you carry a leg of relay parcels between stages." },
    { q: "Can I change route?", a: "Your taxi is approved on one route. Ask Peebee to move it." },
    { q: "How does the line work?", a: "You join the line at your stage behind the taxis ahead. At the front you are Boarding Now, and only one taxi per route boards at a time." },
    { q: "Do I stop selling seats at the stage?", a: "No. Keep selling to walk-up passengers and add those seats in the app, so it always knows how full you are." },
    { q: "How long do app passengers have to pay?", a: "A booked seat has to be paid within a short time, starting at 10 minutes." },
    { q: "What does Peebee charge?", a: "A commission set per route, as a percentage or a flat fee. It is shown in the app." },
    { q: "Can a passenger cancel?", a: "Within 10 minutes of booking they get a full refund. After that Peebee can keep part of the fare, and the app shows it." },
    { q: "What if a passenger doesn't show up?", a: "After a waiting time, starting at 10 minutes, the seat can be marked a no-show. Any fee is applied once per booking." },
    { q: "Who gets a cancellation or no-show fee?", a: "Peebee sets whether it goes to you, whose seat was held, or to Peebee." },
    { q: "How do I get paid for app seats?", a: "Each app seat is a paid order, credited to your wallet in Peebee Car after Peebee's commission." },
    CAR_MONEY[1], SUPPORT,
  ],
  vip: [
    ...CAR_SIGN.slice(0, 2),
    { q: "How does a car become Luxury?", a: "List it with documents and photos, and Peebee approves it into the Luxury category." },
    { q: "When do customers see Luxury?", a: "Only once Peebee has approved at least one Luxury car." },
    { q: "How do bookings reach me?", a: "Customers book for now or for later, say how many hours they need, up to a full day, and add a note about the occasion." },
    { q: "How is it priced?", a: "Distance plus an hourly rate, both set by Peebee and shown before you accept." },
    CAR_SHARE_Q, ...CAR_MONEY,
    { q: "Can I drive it myself?", a: "Yes. Register as owner and driver." },
    ...CAR_TRIP, SUPPORT,
  ],
  ambulance: [
    { q: "How do I register?", a: "In Peebee Car under the Ambulance category, with the vehicle documents and the driver's licence. Peebee approves it like any vehicle." },
    { q: "Does Peebee check medical equipment or licensing?", a: "No. Your medical licensing and equipment remain your responsibility." },
    { q: "Can customers book ahead?", a: "No. Ambulance requests are always immediate." },
    { q: "Who gets the request?", a: "The nearest free crew, with the customer's note about what is happening." },
    { q: "Is Peebee an emergency service?", a: "No. Customers are told to call emergency services first. Peebee helps them reach a crew nearby." },
    { q: "How do I get paid?", a: "The trip is paid in the app and released to your wallet in Peebee Car when it closes." },
    CAR_MONEY[1],
    { q: "Do I need to stay online?", a: "Yes. Requests only reach crews that are online and free." },
    CAR_TRIP[0], SUPPORT,
  ],
  store: [
    { q: "Who can join Peebee Merchant now?", a: "Formal businesses with a smartphone come first. A lighter option for informal stalls comes later." },
    { q: "What kinds of shops?", a: "17 categories, including supermarkets, boutiques, electronics, hardware, beauty, butcheries, stationery, florists and more. Restaurants use Peebee Restaurant instead." },
    { q: "How do I sign up?", a: "Apply in Peebee Merchant at merchant.peebee.online with your business details and documents. Peebee runs business checks before you go live." },
    DEVICE("Peebee Merchant"), MERCH_BRANCH, MERCH_STAFF,
    { q: "How do orders reach me?", a: "Customers order from your listing, and Peebee riders shopping for customers buy at your counter." },
    ...COUNTER,
    { q: "Can I sell with video?", a: "Yes. Spotlight lets you sell with short videos, and live selling comes with the Pro plan with live." },
    ...PLANS,
    ...SETTLE,
    PRACTICE, SUPPORT,
  ],
  grocery: [
    { q: "I only have a market stall. Can I join?", a: "Not yet on your own. The first rollout is for formal retailers with smartphones. A lighter Merchant Lite for stalls comes later." },
    { q: "Which store type do I choose?", a: "Supermarket or Convenience Store / Mini-Mart, or Butchery & Fresh Meat if that is what you sell." },
    { q: "How do I sign up?", a: "Apply in Peebee Merchant at merchant.peebee.online and pass Peebee's business checks." },
    { q: "How do grocery orders reach me?", a: "A rider arrives with a customer's list and buys at your counter. If something is finished, the rider sends a substitute for the customer to approve." },
    ...COUNTER,
    MERCH_STAFF, MERCH_BRANCH,
    ...PLANS,
    ...SETTLE.slice(0, 4),
    SUPPORT,
  ],
  pharmacy: [
    { q: "Who can join?", a: "Only licensed pharmacies. You show your licence from the National Drug Authority and Peebee checks it before you go live." },
    { q: "Which app do I use?", a: "Peebee Pharmacy at pharmacy.peebee.online." },
    { q: "How do orders reach me?", a: "Orders and prescriptions arrive in your inbox. You review the patient's prescription, build a quote and send it." },
    { q: "Can I keep my stock in the app?", a: "Yes. Load your inventory, and confirm orders from what you have." },
    { q: "Who delivers?", a: "A Peebee rider collects from you and delivers." },
    { q: "When do I get paid?", a: "The customer pays before you prepare. Peebee holds it and releases it when the order is handed over with the customer's PIN." },
    { q: "How do I cash out?", a: "Pharmacies use the same merchant wallet as stores: settle to a verified MTN or Airtel Mobile Money destination after a 24-hour cooling period." },
    { q: "What does it cost?", a: "Peebee will confirm pricing with you when you sign up." },
    SUPPORT,
  ],
  restaurant: EAT_BASE("restaurant", { q: "What can I put on my menu?", a: "A full menu with sections, photos, prices and your logo and cover." }),
  "home-kitchen": [
    { q: "Do I need a restaurant?", a: "No. You can sell from your own kitchen. Choose home kitchen when you apply." },
    ...EAT_BASE("kitchen", { q: "What should I list?", a: "A short menu of what you cook best, with photos and prices, and the hours you cook." }),
  ],
  "street-food": [
    { q: "Can a roadside stand join?", a: "Yes. Choose street food when you apply in Peebee Restaurant." },
    ...EAT_BASE("stand", { q: "What should I list?", a: "Your few best items, priced the way you sell them, with photos." }),
  ],
  juice: EAT_BASE("juice bar", { q: "What can I list?", a: "Juices, smoothies and cold drinks, with sizes, combos and photos." }),
  bakery: EAT_BASE("bakery", { q: "What can I list?", a: "Breads, cakes and pastries with photos, and switch items on or off to match what you baked today." }),
  teacher: [
    { q: "How do I start?", a: "Sign up in Peebee Learn at learn.peebee.online, then build a course or schedule a live class." },
    DEVICE("Peebee Learn"),
    { q: "What can I build?", a: "Courses made of modules and lessons, with quizzes, exams and assignments. Learners who finish can earn a certificate." },
    { q: "Can I release lessons gradually?", a: "Yes. Each item can open only when the ones before it are done. Live lessons never hold anyone back." },
    { q: "Can I teach live?", a: "Yes. Run live classrooms for a cohort. Students tap \"I'm here\" to be marked present." },
    { q: "Can I teach on a TV?", a: "Yes. Open Peebee TV on a smart TV, connect it with its code, and push slides and questions to the TV, phones or both." },
    { q: "Who sets the price?", a: "You do. Discount codes and bundles help you fill a course." },
    { q: "How do learners pay?", a: "From their Peebee wallet, in the app." },
    { q: "What does Peebee charge?", a: "A commission that starts at 10% of each payment." },
    { q: "Where does my money go?", a: "Straight to your Peebee wallet, less Peebee's commission." },
    { q: "Can I teach with others?", a: "Yes. Courses you co-teach show under Courses you teach with others." },
    { q: "Can I teach for a school too?", a: "Yes. Schools have their own setup in the same app." },
    { q: "Do learners leave reviews?", a: "Yes, once they have made real progress in the course." },
    PRACTICE, SUPPORT,
  ],
  school: [
    { q: "How do I set up my school?", a: "Create it in Peebee Learn at learn.peebee.online. A school holds classes, and each class holds courses, modules and lessons." },
    { q: "Which learners is it for?", a: "Five streams cover ages 3 to adult: Sprouts, Foundations, Academy, Compass and Skills." },
    { q: "Can I add teachers?", a: "Yes. Teachers run classes and courses, and the gradebook keeps the marks." },
    { q: "Can I collect school fees?", a: "Yes, when Peebee has school fees switched on. Send an invoice for tuition, uniforms, trips or exams, and it can be paid in parts." },
    { q: "What is a school pass?", a: "A pass opens every published course of your school, including ones added later, until it runs out." },
    { q: "Who can pay for a learner?", a: "Anyone with a Peebee account, such as a parent, pays from their Peebee wallet." },
    { q: "What does Peebee charge?", a: "A commission that starts at 10% of each payment." },
    { q: "Where does the money go?", a: "To your Peebee wallet, less Peebee's commission." },
    { q: "Can I teach a whole room at once?", a: "Yes. Show lessons on a TV through Peebee TV and have everyone answer on their phones, with attendance taken in the app." },
    { q: "Are there certificates?", a: "Yes. Learners who finish a course can earn a certificate and badges." },
    PRACTICE, SUPPORT,
  ],
  cleaner: [
    { q: "How is a clean priced?", a: "Most cleans are booked from Peebee's fixed price list. Bigger jobs can be quoted after a look." },
    ...WORK_BASE,
  ],
  laundry: [
    { q: "How is laundry priced?", a: "From a fixed list of services set by Peebee, shown to the customer before they book." },
    ...WORK_BASE,
  ],
  fixer: [
    { q: "How are repairs priced?", a: "Simple jobs have a fixed price. For the rest you inspect, then send a quote of up to UGX 5,000,000, valid for 24 hours." },
    { q: "What if the customer turns my quote down?", a: "You keep the call-out fee that was held at booking, less Peebee's commission." },
    { q: "What if they accept?", a: "The customer pays the difference into escrow and the job is booked." },
    ...WORK_BASE,
  ],
  worker: [
    { q: "Is it open?", a: "Not yet. It is built and waiting to be switched on." },
    { q: "When does it open?", a: "Peebee has not set a date." },
    { q: "Who will be able to join?", a: "Anyone with a Peebee account, including riders and partners who want side income." },
    { q: "How should I get ready?", a: "Keep your Peebee account active and watch for Find work in the app." },
  ],
  talent: [
    { q: "Is Peebee Hire open?", a: "Not yet. It is built and switched off for now." },
    { q: "When does it open?", a: "Peebee has not set a date." },
    { q: "What will it do?", a: "Employers post work, you apply or bid, and payment can be held until the job is done. Peebee screens out unlawful work." },
    { q: "How should I get ready?", a: "Keep your Peebee account active and watch for Hire in the app." },
  ],
};
