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
  /** Minutes Boarding Now before a driver may leave with free seats (departure rule "after wait"). */
  waitMinutes: number;
  /** How close (metres) a driver must be to the start stage to join the line. 0 turns the check off. */
  stageRadiusM: number;
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

/** A taxi (matatu, minibus) approved to run on a route. One approval, two switches. */
export type TaxipressTaxi = {
  id: string;
  userId: string;
  relayRouteId: string;
  routeName: string | null;
  plate: string;
  seatLayout: "14" | "18";
  seats: number;
  /** The taxi may join the line and take seats. */
  passengersEnabled: boolean;
  /** The taxi may carry relay parcels. */
  parcelsEnabled: boolean;
  status: "pending" | "approved" | "suspended";
  driverName?: string | null;
  driverPhone?: string | null;
};

export type TaxipressLineEntry = {
  id: string;
  taxiId: string;
  driverId: string;
  status: "in_line" | "boarding" | "on_road" | "arrived" | "cancelled";
  /** 1 for the taxi at the front. Only taxis still waiting have one. */
  position: number | null;
  plate: string;
  seatLayout: "14" | "18";
  seatsTotal: number;
  seatsBooked: number;
  walkUpSeats: number;
  seatsTaken: number;
  seatsLeft: number;
  fullyBooked: boolean;
  joinedAt: string;
  boardingAt: string | null;
  departedAt: string | null;
  driverName: string | null;
};

/** Everything the driver's Taxipress screen needs. */
export type TaxipressDriverView = {
  /** False until the Taxipress taxi and line tables exist. */
  ready: boolean;
  enabled: boolean;
  taxi: TaxipressTaxi | null;
  /** Routes a driver can apply to run a taxi on. */
  applyRoutes: Array<{ id: string; name: string }>;
  /** The directions this taxi's route runs, to join the line for. */
  routes: Array<{ id: string; fromName: string; toName: string }>;
  entry: (TaxipressLineEntry & { taxipressRouteId: string }) | null;
  /** The line the driver is in. */
  line: TaxipressLineEntry[];
  canGoOnRoad: boolean;
  onRoadReason: string | null;
  departureRule: "full_only" | "driver_choice" | "after_wait";
  waitMinutes: number;
  /** Staff's rule is on and the driver owes too much to join the line. */
  owingBlocked: boolean;
};

export type TaxipressAdminQueueEntry = TaxipressLineEntry & { taxipressRouteId: string; driverPhone: string | null };
