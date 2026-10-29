# Costing, money-flow and wallet-credit spec (proposal, not yet built)

Status: **for review**. Nothing here is implemented. Every number below is an admin setting
(stored in `settings`, validated in `settings/routes.ts`, shown on an admin page, recorded in the
activity log, safe default), per `CLAUDE.md`. The "default" column is the launch value; it is
not a constant in code.

## 0. What exists today (so we extend, not duplicate)

| Area | Today | Where |
|---|---|---|
| Boda fare | `ride_rate_per_km`, `ride_minimum_fare`, `ride_stop_fee`, name-your-fare band | `lib/settings.ts`, `orders/ride-extras.ts` |
| Car fare | `car_convenient_rate_per_km` (2000), `car_convenient_minimum_fare` (8000), comfort/XL premium % | `lib/settings.ts` |
| Delivery fare | `delivery_rate_per_km`, `minimum_delivery_fee` | `lib/settings.ts` |
| Fees on an order | Delivery commission %, service fee, processing fee (customer / rider / split) | `lib/monetization.ts`, table `order_fees` |
| Cancel / waiting fee | Disclosed time fees | table `order_time_fees` |
| Payment rails | Yo, Flutterwave, MTN, Airtel (+ mocks); no per-rail fee table | `payments/service.ts` |
| Customer wallet | One balance + `wallet_ledger`, secondary wallets, caps | `wallet/service.ts` |
| Rider wallet | `riders.wallet_balance` (+ sandbox), top-up, withdraw | `riders/routes.ts` |
| Platform ledger | Double-entry (`ledger_accounts / transactions / entries`) | `ledger/service.ts` |
| Module commissions | Each module has its own scattered percent (marketplace 10, learn 10, work 15, laundry 15, services 5, taxipress, talent) | `lib/settings.ts` |

The gap: there is no single place that says, for one payment, *customer paid X; gateway took A;
tax B; Peebee C; rider/merchant D*, and each module computes its own split differently.

## 1. Fare engine (rides and deliveries)

One pure function, `quoteFare(vehicle, route, context, rules) -> FareBreakdown`, used by the
quote, the booking and the receipt, so all three always agree. Each vehicle/service has its own
rule set (boda, car-convenient, car-comfort, car-XL, parcel, shopping delivery, ...).

### 1.1 Distance charge
- **Base fare** (flat, covers pickup): default 0.
- **Distance bands** (tapering rate). A list of bands, each `from_km, to_km, rate_per_km`.
  Example for car: 0-5 km at 5,000; 5-15 km at 4,500; 15-40 km at 4,000; 40+ km at 3,500.
  Each km is charged at the rate of the band it falls in (marginal, so the fare never drops as
  distance grows).
- **Minimum fare**, per vehicle (car 10,000).
- **Maximum fare cap** (optional, 0 = none).
- **Rounding**: nearest 100 / 500 / 1,000, up / nearest.
- **Distance source**: straight-line x road-factor (default 1.3) or routed distance when the maps
  provider returns one.

### 1.2 Time charge
- Per-minute rate, applied from the trip's expected duration (optional, default 0).
- **Free waiting minutes** at pickup, then **waiting fee per minute**, with a cap.
- **Delay / traffic fee**: when actual duration exceeds expected by more than X%, add per-minute
  or % uplift, capped.

### 1.3 Multipliers (stack in a stated order, with an overall cap)
| Multiplier | Trigger | Default |
|---|---|---|
| Fuel adjustment | Admin raises/lowers one % when fuel price moves; per vehicle | 0% |
| Peak hours | Time windows (e.g. 07-09, 17-20), days of week | off |
| Night | Time window | off |
| Demand (surge) | Open requests / online riders in the zone above a ratio | off |
| Traffic | Heavy-traffic flag from the maps provider, or manual admin switch | off |
| Rain / weather | Manual admin switch (a "bad weather" toggle) | off |
| Zone | Per-zone markup (airport, hills, under-served areas) | off |
| Holiday / event | Dated windows | off |
| Vehicle class | Comfort +30%, XL +50% (already exist) | existing |
| Overall cap | Maximum combined multiplier (e.g. 2.5x) | 2.5x |

Order of operations (fixed and shown on the admin page): distance bands -> time charge ->
vehicle class -> multipliers (combined, capped) -> add-ons -> minimum/maximum -> rounding.

### 1.4 Add-ons and fees
- Per extra stop (exists), toll / parking pass-through, luggage / size surcharge, pickup-distance
  compensation (rider travelled far to reach pickup), airport fee, booking fee (flat, platform
  revenue), scheduled-ride fee, return-trip discount.
- **Cancellation fee**: free window (minutes), then flat or %; different amounts if the rider has
  already arrived; share paid to the rider vs Peebee (%).
- **No-show fee**, **rider-cancel penalty** (rider side), **waiting fee** share to the rider.

### 1.5 Delivery-specific
Weight/size band, fragile, multi-drop, return-to-sender, cash-on-delivery handling fee, shopping
service fee. Same distance bands and multipliers as rides.

### 1.6 Result and receipt
`FareBreakdown` stores every component (base, distance by band, time, each multiplier with its
value, each add-on, discount, rounding). It is saved with the order, so a later settings change
never alters a past receipt, and an admin can open any order and see exactly how its price was
built. The existing "name your fare" band applies on top of the quote.

## 2. Money-flow waterfall (every payment, every module)

For any payment, one record, `payment_splits`, with these lines. All amounts integer UGX.

```
Customer pays (gross)
  - Gateway fee            (rail + network specific, section 3)
  - Tax: VAT / excise      (section 4, on whichever base admin sets)
  - Tax: withholding       (on provider/merchant payout, if enabled)
  = Net distributable
      - Platform commission    (Peebee)
      - Platform maintenance   (% of commission or of gross, earmarked reserve)
      - Provider share         (rider / merchant / driver / school / seller)
```
Invariant enforced in code and tests: `gross = gateway + tax + commission + maintenance + provider + customer_credit_applied`
(nothing is created or lost), and the lines post to the existing double-entry ledger so
`assertLedgerBalanced` holds.

### 2.1 Commission model, per module and per service
`commission_type`: `percent` | `flat` | `percent_with_min_max` | `tiered_by_volume`.
Also: `commission_base` (fare only / fare + fees / items only), `commission_timing`
(`at_checkout` | `on_payout`), cash vs digital rate (cash rides owe Peebee from the wallet).
Modules to cover with one shared settings shape: boda, car, delivery (parcel), shopping,
restaurants, merchants/marketplace, pharmacy, gas, laundry, learn, work, talent, taxipress,
services-platform, ads. Existing per-module percentages migrate into this shape with the same
values, so nothing changes until an admin edits them.

### 2.2 Merchant-facing dynamics
- Commission % (normal, elite/plan override), flat per order, listing/ad fees.
- Who funds a merchant's own offers (merchant, Peebee, or split) and how that changes payout.
- Payout schedule (instant / daily / weekly), minimum payout, holdback % for refunds.
- A merchant statement shows gross, discounts, commission, gateway, tax, net, per order.

### 2.3 Estimated vs actual
Before a module goes live, admin gets a **calculator**: pick a module and an amount (say 10,000)
and see the full waterfall with who gets what. After payment, the actual row is the truth.

## 3. Payment aggregators and the transaction fee

New table `payment_provider_fees`: provider (Yo, Flutterwave, MTN, Airtel, PesaPal and future
ones), direction (collection / disbursement), network (MTN, Airtel, card), fee type (percent /
flat / percent + flat), min fee, max fee, `effective_from`. Rates change, so rows are versioned;
a payment records the rate row it used.

- **Who pays the gateway fee** (setting per flow: ride, order, wallet top-up, withdrawal):
  - `customer` - added on top at checkout (customer pays 10,000 + fee).
  - `platform` - customer pays exactly 10,000; Peebee absorbs the fee out of its commission.
  - `provider` - deducted from the rider/merchant payout.
  - `split` - percentages between the above.
- **Record the real fee**: when the gateway reports the actual fee, store it beside the estimate;
  reconciliation flags drift beyond a threshold.
- **Platform-absorbs guard**: a marketing spend line, so absorbed fees show as "promo cost",
  with an optional monthly budget cap after which the fee flips to `customer`.

## 4. Taxes

New `tax_rules`: name (VAT, excise duty on mobile money, withholding), rate %, `applies_to`
(commission / platform fee / gateway fee / gross / payout), `inclusive` or `added on top`,
per-module switch, effective dates. The waterfall shows each tax as its own line and a
**tax payable** ledger account accumulates what Peebee owes the government (exportable report).
Defaults ship **off**; the exact legal rates and bases need your accountant's confirmation, and I
will not hard-code any.

## 5. Wallet: funding, bonuses and restricted credit

### 5.1 Two kinds of balance in the customer wallet
- **Cash balance** - real deposited money. Spendable on everything, withdrawable (subject to 5.4).
- **Credit balance** - bonuses, cashback, promo credit, make-whole top-ups. **Spendable only on
  Peebee, never withdrawable**, and only where allowed (5.3). Credits can expire.

The customer sees one number plus a breakdown ("UGX 10,500: 10,000 cash + 500 credit").
Spending order is a setting: credit first (default) or cash first.

### 5.2 Top-up behaviour
Customer loads 10,000 via mobile money; the gateway fee (say 2.5%) and tax come out.
`topup_fee_mode`:
- `customer_pays` - they receive 10,000 minus fees (today's behaviour).
- `make_whole` - they receive exactly 10,000 shown as: net cash credited + **top-up credit**
  covering the fee. The covered amount is **credit (non-withdrawable)**, not cash, so a customer
  cannot deposit and withdraw to drain Peebee's fee cost.
- `make_whole` can be limited to a minimum top-up, first N top-ups, or a monthly budget.

**Deposit bonus**: flat UGX or % per deposit, with min deposit, max bonus per deposit, max per
customer per month, optional first-deposit-only, optional campaign dates. Credited as **credit**.

### 5.3 Where credit can be spent
Admin toggles per module (rides, car, delivery, restaurants, marketplace, pharmacy, ... default
rides + delivery), and optionally a **partner list**: specific merchants/restaurants/providers
where credit is accepted (and the discount is funded by Peebee or by the partner under a deal).
A "sponsored credit" is credit tagged to a campaign and spendable only at that campaign's partners.
Credit used on a partner order is settled to the partner normally; Peebee's cost shows as
promo spend.

### 5.4 Anti-farming controls (all settings)
- **Withdrawal lock**: cash from a deposit cannot be withdrawn for N days (default 3).
- **Withdraw at most X% of cash balance** per request and a daily cap; always keep the minimum.
- Credit is **never** withdrawable or transferable to another customer.
- One bonus-eligible deposit per phone / device / payment account; velocity limits (max bonus
  deposits per day); flag deposit-then-withdraw patterns and hold for review.
- Refunds of an order paid with credit return **credit**, not cash.
- Bonus clawback if the deposit is reversed or charged back.
- Every credit/debit written to `wallet_ledger` with bucket, source, and campaign.

### 5.5 Rider discount wallet (from the earlier proposal)
Same credit mechanism on the rider side: funded when a customer rides with an offer, offset
against Peebee commission first, optional payout methods and schedule. Kept in the same
promo-spend reporting.

## 6. Offers (as proposed earlier)
Customer offers, rider incentives and merchant-funded offers all create **promo spend** lines in
the waterfall with a stated funder (Peebee / merchant / rider), so the books always show who
paid for each discount.

## 7. Admin layout
Admin -> **Pricing**: Ride & delivery fares (one tab per vehicle), Multipliers, Fees & penalties,
Preview calculator.
Admin -> **Money flow**: Module commissions, Payment providers & fees, Taxes, Platform
maintenance reserve, Who-pays rules, Calculator, Reports (per-payment splits, tax payable,
promo spend, gateway fee drift).
Admin -> **Wallet & credit**: Top-up (make-whole, deposit bonus), Credit rules (where spendable,
partners, expiry), Withdrawal & anti-farming, Rider discount wallet.
Admin -> **Offers**: as proposed.
Every page: validated, permission-gated (`payments.manage`), activity-logged, with a live preview.

## 8. Safety plan
- **Migrations by hand**: one migration per phase, listed in the PR; all new code guarded by
  `hasColumn()/hasTable()` and behind switches that default **off**, so production keeps the
  current behaviour until you flip them.
- **Snapshot at the moment of payment** (fare breakdown, rates, fee row, tax rows) so later
  setting changes never rewrite history.
- **Integer money only**, one rounding rule, residual cent-equivalent always assigned to the
  platform line so lines sum exactly.
- **Tests**: waterfall invariant, band boundaries, multiplier cap, make-whole top-up, bonus caps,
  withdrawal lock, credit non-withdrawable, refund-to-credit, sandbox vs live columns.
- **Sandbox/practice** run the same engine on demo data (`practice-runtime.ts`).

## 9. Phases
1. Fare engine + admin Pricing (cars at 5,000/km, 10,000 min, bands, multipliers, fees); receipts.
2. Money-flow waterfall: provider fee table, tax rules, commission shape, `payment_splits`,
   calculator, wired to rides and deliveries first.
3. Wallet credit buckets, make-whole top-up, deposit bonus, withdrawal controls.
4. Roll modules onto the waterfall one at a time (merchants/restaurants first).
5. Offers, rider discount wallet and rider incentives.
6. Reports and reconciliation views.

## 10. Decisions needed before building
1. Tax: which taxes apply, their rates and bases (confirm with your accountant)?
2. Should "make-whole" top-up cover fees only, or also tax?
3. Credit spending order: credit first or cash first? Default credit expiry (never / 90 days)?
4. Is the platform-maintenance reserve a % of Peebee's commission or of gross?
5. Which module do you want live first on the new waterfall after rides and deliveries?
