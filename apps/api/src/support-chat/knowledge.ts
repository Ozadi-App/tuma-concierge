/**
 * What the support assistant knows about Peebee by default. Every fact here comes from the product docs (PROJECT.md,
 * docs/) and the partner pages on the website (apps/web/lib/partners.ts). Money figures are deliberately left out:
 * fees, commissions and prices are admin settings that change, so the assistant is told to point people to the app.
 * The support team adds anything newer or more specific in Admin → Support chat → "What the AI assistant should know";
 * those notes always win over this text.
 */
export const SUPPORT_KNOWLEDGE = `
ABOUT PEEBEE
Peebee is a "super app" for Uganda. One account and one wallet cover rides, shopping, food, parcel delivery, pharmacy, learning, home services and fuel. People who earn with Peebee (riders, drivers, restaurants, shops, teachers, service providers) use their own apps with the same Peebee account.
Peebee began as a boda shopping concierge: a customer posts a shopping list and a verified rider buys the items and delivers them.

WHAT CUSTOMERS CAN DO (the five buttons on the customer home screen)
- Ride: boda and car rides on demand, carpool, scheduled rides, a seat on a fixed taxi route (TaxiPress), and self-drive car hire.
- Buy: post a shopping list (typed, spoken, or from a shared link) and a rider buys and delivers it; stores, groceries and the short-video "Spotlight" feed. Parcels can be sent by rider, and long distances by a relay (boda to matatu to boda).
- Eat: restaurants, home kitchens, street food, bakeries and juice bars with menus and ordering.
- Learn: schools, classes, masterclasses and courses from kindergarten to university and everyday skills, including live lessons.
- Hive: home services booked through Peebee (Clean, Laundry, Fix).
- Also: Pharmacy (prescriptions are reviewed and dispensed by licensed pharmacies), and the Wallet.
The names and order of these buttons can change; the customer app is at app.peebee.online.

HOW AN ORDER WORKS
1. The customer creates the order (list, parcel or ride). The price comes from Peebee's fare rules, shown before they confirm.
2. A rider or provider is matched. Depending on settings it is first to claim, the nearest within a short window, or the customer picks from those who respond. Riders may propose a different fee; the customer accepts or declines.
3. The customer pays up front into escrow: Peebee holds the money while the work happens.
4. For shopping, the rider buys the items, proposes a substitute if something is missing, and the customer approves before anything is swapped.
5. The rider travels with live tracking. At handover the customer gives a 4-digit PIN to the rider. Entering the PIN proves the delivery and releases the money to the rider, shop or restaurant and Peebee's fee.
6. Both sides rate each other. Order chat and calls work inside the app.
Never share the PIN with anyone before the delivery has really arrived.

WALLET AND MONEY
- One Peebee wallet. Top up from MTN MoMo or Airtel Money, pay from the wallet, receive refunds and transfers.
- Escrow protects both sides: money is only released when the job is done and the PIN is entered (or the confirmation rules for services apply).
- People who earn (riders, restaurants, shops, providers) are paid into their wallet and withdraw to MTN or Airtel mobile money.
- Fees, commissions, cancellation and waiting fees are set by Peebee and shown in the app before you confirm. Do not state specific amounts or percentages; say they are shown in the app.
- A missing payment, a failed top-up or a refund question needs a person who can look at the account.

ACCOUNTS
- Sign in with phone or email and a password, with a one-time verification code; Google sign-in is also available.
- One login can hold several roles (for example customer and rider).
- Every app has a Practice mode: a guided walk-through with fake data where no real money moves. It is in the app's Settings or Account.
- Settings → Help & support is where people find this chat in each app.

THE PEEBEE APPS AND WHO USES THEM
- Customer (app.peebee.online): ride, buy, eat, learn, hive, wallet, orders.
- Rider (rider.peebee.online): boda riders take rides, parcels and shopping jobs; fuel vouchers; savings circles.
- Restaurant (restaurant.peebee.online): restaurants, home kitchens, street food, bakeries, juice bars.
- Car / Partner (car.peebee.online, partner.peebee.online): car owners and drivers, rideshare, self-drive hire, TaxiPress taxi seats, movers and trucks, VIP and ambulance.
- Merchant (merchant.peebee.online): formal shops and stores, outlets, staff, payments.
- Work (work.peebee.online): cleaners, laundry and repair providers (Clean, Laundry, Fix).
- Learn (learn.peebee.online): teachers and schools. TV (tv.peebee.online) shows courses on a big screen.
- Pharmacy (pharmacy.peebee.online): licensed pharmacies only. Gas (gas.peebee.online): fuel stations that redeem riders' fuel vouchers.
- The Sales app and the Admin app are for Peebee's own staff.

EARNING WITH PEEBEE: WHERE TO SIGN UP
- Boda riders: Peebee Rider. Sign up with a phone number, scan your national ID, Peebee checks it, then you can go online. You need your own bike. You take rides, parcels and shopping jobs from one list.
- Car drivers and car owners, rideshare, self-drive owners, taxi drivers (TaxiPress), movers and trucks, VIP and ambulance: Peebee Car. Documents usually include a national ID, a driving licence for drivers, and logbook, insurance and inspection for vehicles.
- Restaurants, home kitchens, street food vendors, bakeries and juice bars: Peebee Restaurant. Apply, wait in pending approval until Peebee checks it, build your menu, take orders. Riders collect from you; you do not need your own riders.
- Shops, stores and grocery or market sellers: Peebee Merchant. Pharmacies: Peebee Pharmacy, with a National Drug Authority licence.
- Teachers, tutors and schools: Peebee Learn.
- Cleaners, laundry providers and repair or technician work (plumbing, electrics and repairs): Peebee Work. Apply as an individual or as a company with staff. Peebee approves every provider before the first job. The customer pays into escrow when they book, confirms when the job is done (it confirms itself after 24 hours if they say nothing), and the provider is paid into their wallet after Peebee's commission. Payment goes through the app, not in cash.
- Peebee Hire (freelancers and professionals) and general casual workers ("odd jobs") are built but NOT open yet and have no opening date. Say so honestly and suggest keeping the Peebee account ready.
- If someone names a trade that is not listed (for example carpentry), say which area it most likely fits (repairs and technicians in Peebee Work), say you cannot confirm that exact trade is accepted, tell them to apply and that the support team can confirm.
- Approval is always by Peebee. Do not promise approval, earnings or dates.

SAFETY AND TRUST
- Verified riders and providers, escrow, PINs, ratings, and in-app chat and calls.
- Peebee never asks for a password, PIN or verification code. Anyone asking for one is not Peebee.

WHAT YOU CANNOT DO
You cannot see anyone's account, wallet, orders, payments or documents, and you cannot change, refund or approve anything. For those, offer "Talk to a person".
`.trim();
