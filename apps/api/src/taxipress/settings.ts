import { getSetting, setSetting } from "../lib/settings.js";

/**
 * Taxipress (scheduled shared-taxi seats on fixed routes) is controlled from Admin:
 * whether it runs, when a taxi may leave, how Peebee's cut is worked out, the seat
 * rules and what a taxi may carry as a relay parcel. Everything here has a safe default.
 */
export type TaxipressSettings = {
  enabled: boolean;
  /** full_only: a taxi leaves only when every seat is booked. The others let the driver go sooner. */
  departureRule: "full_only" | "driver_choice" | "after_wait";
  /** Seats still free on a taxi that is On Road may be sold in the app. */
  sellFreeSeatsOnRoad: boolean;
  commissionType: "percent" | "flat";
  commissionDigitalPercent: number;
  commissionCashPercent: number;
  commissionFlatUgx: number;
  /** Block a driver from joining the line while they owe Peebee more than maxOwedUgx. */
  blockWhenOwing: boolean;
  maxOwedUgx: number;
  cashEnabled: boolean;
  seatChoiceFeeUgx: number;
  returnDiscountPercent: number;
  maxSeatsPerBooking: number;
  /** Which taxi may take a relay parcel: only the one Boarding Now, or any taxi in the line. */
  parcelAcceptRule: "boarding_now" | "any_in_line";
  /** Most parcels one taxi takes per trip, by seat count. 0 means none until staff set it. */
  maxParcels14: number;
  maxParcels18: number;
  parcelFitText: string;
  parcelNotAllowed: string[];
  /** Minutes Boarding Now before a driver may leave with free seats (departure rule "after wait"). */
  waitMinutes: number;
  /** How close (metres) a driver must be to the start stage to join the line. 0 turns the check off. */
  stageRadiusM: number;
  /** Minutes to pay for a seat in the app before it is given back. */
  payWithinMinutes: number;
  /** Most cash bookings one passenger may hold at a time. */
  maxCashBookings: number;
  /** Minutes after booking a passenger may cancel for a full refund. */
  freeCancelMinutes: number;
  /** After that, the share of the fare kept from a paid seat that is cancelled. */
  cancelRetentionPercent: number;
  /** Who receives a kept cancellation or no-show fee. */
  feeTo: "driver" | "peebee";
  /** Minutes Boarding Now before a driver may mark an absent passenger a no-show. */
  noShowMinutes: number;
  /** Share of the fare kept from a paid seat when the passenger does not board. */
  noShowFeePercent: number;
  /** Move a removed taxi's passengers to the next taxi with room, instead of refunding them. */
  rebookOnRemoval: boolean;
};

const bool = (value: string | null, fallback: boolean) => (value == null ? fallback : value === "1");
const whole = (value: string | null, fallback: number, max: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
};
const percent = (value: string | null) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 0;
};

function items(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 60)).slice(0, 50);
  } catch {
    return [];
  }
}

export async function getTaxipressSettings(): Promise<TaxipressSettings> {
  const [
    enabled, rule, sellRoad, type, digital, cash, flat, block, owed, cashOn, seatFee, discount, maxSeats, accept, p14, p18, fit, notAllowed, wait, radius, payWithin, maxCash, freeCancel, retention, feeTo, noShowMin, noShowFee, rebook,
  ] = await Promise.all([
    getSetting("taxipress_enabled"),
    getSetting("taxipress_departure_rule"),
    getSetting("taxipress_sell_free_seats_on_road"),
    getSetting("taxipress_commission_type"),
    getSetting("taxipress_commission_digital_percent"),
    getSetting("taxipress_commission_cash_percent"),
    getSetting("taxipress_commission_flat_ugx"),
    getSetting("taxipress_block_when_owing"),
    getSetting("taxipress_max_owed_ugx"),
    getSetting("taxipress_cash_enabled"),
    getSetting("taxipress_seat_choice_fee_ugx"),
    getSetting("taxipress_return_discount_percent"),
    getSetting("taxipress_max_seats_per_booking"),
    getSetting("taxipress_parcel_accept_rule"),
    getSetting("taxipress_max_parcels_14"),
    getSetting("taxipress_max_parcels_18"),
    getSetting("taxipress_parcel_fit_text"),
    getSetting("taxipress_parcel_not_allowed"),
    getSetting("taxipress_wait_minutes"),
    getSetting("taxipress_stage_radius_m"),
    getSetting("taxipress_pay_within_minutes"),
    getSetting("taxipress_max_cash_bookings"),
    getSetting("taxipress_free_cancel_minutes"),
    getSetting("taxipress_cancel_retention_percent"),
    getSetting("taxipress_fee_to"),
    getSetting("taxipress_no_show_minutes"),
    getSetting("taxipress_no_show_fee_percent"),
    getSetting("taxipress_rebook_on_removal"),
  ]);
  return {
    enabled: enabled === "1",
    departureRule: rule === "driver_choice" || rule === "after_wait" ? rule : "full_only",
    sellFreeSeatsOnRoad: bool(sellRoad, false),
    commissionType: type === "flat" ? "flat" : "percent",
    commissionDigitalPercent: percent(digital),
    commissionCashPercent: percent(cash),
    commissionFlatUgx: whole(flat, 0, 1_000_000),
    blockWhenOwing: bool(block, false),
    maxOwedUgx: whole(owed, 0, 100_000_000),
    cashEnabled: bool(cashOn, true),
    seatChoiceFeeUgx: whole(seatFee, 0, 100_000),
    returnDiscountPercent: percent(discount),
    maxSeatsPerBooking: Math.max(1, whole(maxSeats, 4, 30)),
    parcelAcceptRule: accept === "any_in_line" ? "any_in_line" : "boarding_now",
    maxParcels14: whole(p14, 0, 50),
    maxParcels18: whole(p18, 0, 50),
    parcelFitText: fit.slice(0, 200),
    parcelNotAllowed: items(notAllowed),
    waitMinutes: whole(wait, 30, 600),
    stageRadiusM: whole(radius, 300, 5000),
    payWithinMinutes: Math.max(1, whole(payWithin, 10, 1440)),
    maxCashBookings: whole(maxCash, 2, 50),
    freeCancelMinutes: whole(freeCancel, 10, 1440),
    cancelRetentionPercent: percent(retention),
    feeTo: feeTo === "peebee" ? "peebee" : "driver",
    noShowMinutes: whole(noShowMin, 10, 240),
    noShowFeePercent: percent(noShowFee),
    rebookOnRemoval: bool(rebook, true),
  };
}

export async function setTaxipressSettings(next: Partial<TaxipressSettings>): Promise<void> {
  const flag = (value: boolean) => (value ? "1" : "0");
  if (next.enabled != null) await setSetting("taxipress_enabled", flag(next.enabled));
  if (next.departureRule != null) await setSetting("taxipress_departure_rule", next.departureRule);
  if (next.sellFreeSeatsOnRoad != null) await setSetting("taxipress_sell_free_seats_on_road", flag(next.sellFreeSeatsOnRoad));
  if (next.commissionType != null) await setSetting("taxipress_commission_type", next.commissionType);
  if (next.commissionDigitalPercent != null) await setSetting("taxipress_commission_digital_percent", String(next.commissionDigitalPercent));
  if (next.commissionCashPercent != null) await setSetting("taxipress_commission_cash_percent", String(next.commissionCashPercent));
  if (next.commissionFlatUgx != null) await setSetting("taxipress_commission_flat_ugx", String(next.commissionFlatUgx));
  if (next.blockWhenOwing != null) await setSetting("taxipress_block_when_owing", flag(next.blockWhenOwing));
  if (next.maxOwedUgx != null) await setSetting("taxipress_max_owed_ugx", String(next.maxOwedUgx));
  if (next.cashEnabled != null) await setSetting("taxipress_cash_enabled", flag(next.cashEnabled));
  if (next.seatChoiceFeeUgx != null) await setSetting("taxipress_seat_choice_fee_ugx", String(next.seatChoiceFeeUgx));
  if (next.returnDiscountPercent != null) await setSetting("taxipress_return_discount_percent", String(next.returnDiscountPercent));
  if (next.maxSeatsPerBooking != null) await setSetting("taxipress_max_seats_per_booking", String(next.maxSeatsPerBooking));
  if (next.parcelAcceptRule != null) await setSetting("taxipress_parcel_accept_rule", next.parcelAcceptRule);
  if (next.maxParcels14 != null) await setSetting("taxipress_max_parcels_14", String(next.maxParcels14));
  if (next.maxParcels18 != null) await setSetting("taxipress_max_parcels_18", String(next.maxParcels18));
  if (next.parcelFitText != null) await setSetting("taxipress_parcel_fit_text", next.parcelFitText);
  if (next.parcelNotAllowed != null) await setSetting("taxipress_parcel_not_allowed", JSON.stringify(next.parcelNotAllowed));
  if (next.waitMinutes != null) await setSetting("taxipress_wait_minutes", String(next.waitMinutes));
  if (next.stageRadiusM != null) await setSetting("taxipress_stage_radius_m", String(next.stageRadiusM));
  if (next.payWithinMinutes != null) await setSetting("taxipress_pay_within_minutes", String(next.payWithinMinutes));
  if (next.maxCashBookings != null) await setSetting("taxipress_max_cash_bookings", String(next.maxCashBookings));
  if (next.freeCancelMinutes != null) await setSetting("taxipress_free_cancel_minutes", String(next.freeCancelMinutes));
  if (next.cancelRetentionPercent != null) await setSetting("taxipress_cancel_retention_percent", String(next.cancelRetentionPercent));
  if (next.feeTo != null) await setSetting("taxipress_fee_to", next.feeTo);
  if (next.noShowMinutes != null) await setSetting("taxipress_no_show_minutes", String(next.noShowMinutes));
  if (next.noShowFeePercent != null) await setSetting("taxipress_no_show_fee_percent", String(next.noShowFeePercent));
  if (next.rebookOnRemoval != null) await setSetting("taxipress_rebook_on_removal", flag(next.rebookOnRemoval));
}
