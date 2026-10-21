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
    enabled, rule, sellRoad, type, digital, cash, flat, block, owed, cashOn, seatFee, discount, maxSeats, accept, p14, p18, fit, notAllowed,
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
}
