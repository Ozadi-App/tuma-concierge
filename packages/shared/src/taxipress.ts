/** Taxipress: scheduled shared-taxi seats on fixed routes. See apps/api/src/taxipress. */

export type TaxipressSettings = {
  enabled: boolean;
  /** full_only: a taxi leaves only when every seat is booked. The others let the driver go sooner. */
  departureRule: "full_only" | "driver_choice" | "after_wait";
  sellFreeSeatsOnRoad: boolean;
  commissionType: "percent" | "flat";
  commissionDigitalPercent: number;
  commissionCashPercent: number;
  commissionFlatUgx: number;
  blockWhenOwing: boolean;
  maxOwedUgx: number;
  cashEnabled: boolean;
  seatChoiceFeeUgx: number;
  returnDiscountPercent: number;
  maxSeatsPerBooking: number;
  parcelAcceptRule: "boarding_now" | "any_in_line";
  /** Most parcels one taxi takes per trip, by seat count. 0 means none until staff set it. */
  maxParcels14: number;
  maxParcels18: number;
  parcelFitText: string;
  parcelNotAllowed: string[];
};

/** What the customer app needs to decide whether to show Taxipress, and what to say. */
export type TaxipressConfig = {
  /** True only when staff switched it on and at least one route is running. */
  enabled: boolean;
  routes: Array<{
    id: string;
    /** The way along the route, written like a ticket: "KLA - EBB". */
    directionLabel: string;
    routeCode: string;
    fromName: string;
    toName: string;
    farePerSeat: number;
  }>;
  cashEnabled: boolean;
  seatChoiceFeeUgx: number;
  returnDiscountPercent: number;
  maxSeatsPerBooking: number;
  parcelFitText: string;
  parcelNotAllowed: string[];
};

export type TaxipressAdminRoute = {
  id: string;
  relayRouteId: string;
  direction: "a_to_b" | "b_to_a";
  directionLabel: string;
  routeCode: string;
  fromName: string;
  toName: string;
  farePerSeat: number;
  stopPricingEnabled: boolean;
  active: boolean;
  /** The relay route underneath is itself on. */
  relayActive: boolean;
};

/** A route set up in Relay delivery that Taxipress can run on. */
export type TaxipressRelayRoute = { id: string; name: string; stageAName: string; stageBName: string; active: boolean };
