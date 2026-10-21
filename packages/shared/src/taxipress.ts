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
  /** Minutes to pay for a seat in the app before it is given back. */
  payWithinMinutes: number;
  /** Most cash bookings one passenger may hold at a time. */
  maxCashBookings: number;
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
  /** Minutes to pay for a seat in the app before it is given back. */
  payWithinMinutes: number;
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
  /** The passengers booked on the driver's taxi. */
  bookings: TaxipressManifestPassenger[];
};

export type TaxipressAdminQueueEntry = TaxipressLineEntry & { taxipressRouteId: string; driverPhone: string | null };

export type TaxipressBookingStatus = "booked" | "boarded" | "no_show" | "cancelled" | "completed";
/** unpaid: an app payment is still due. paid: collected in the app. pay_driver: cash, to be paid to the driver. */
export type TaxipressPaymentStatus = "unpaid" | "paid" | "pay_driver" | "cancelled";

export type TaxipressBooking = {
  id: string;
  /** The order behind the booking: payment, chat, calls and tracking use it. */
  orderId: string;
  status: TaxipressBookingStatus;
  seats: number;
  farePerSeat: number;
  amount: number;
  paymentMethod: "app" | "cash";
  paymentStatus: TaxipressPaymentStatus;
  /** What the driver checks at boarding (also shown as a QR code). */
  ticketCode: string | null;
  createdAt: string;
  /** An app payment still due must be made by this time or the seats are given back. */
  payBy: string | null;
  route: { id: string; fromName: string; toName: string; directionLabel: string };
  taxi: { queueId: string; plate: string; seatLayout: "14" | "18"; driverName: string | null; driverPhone: string | null; status: string; position: number | null; seatsLeft: number };
};

/** A passenger on a driver's taxi. */
export type TaxipressManifestPassenger = {
  id: string;
  passengerName: string | null;
  passengerPhone: string | null;
  seats: number;
  amount: number;
  paymentMethod: "app" | "cash";
  paymentStatus: TaxipressPaymentStatus;
  status: TaxipressBookingStatus;
};

/** The taxis waiting on a route, with the route's fare, for the passenger's choice. */
export type TaxipressQueueView = {
  line: TaxipressLineEntry[];
  onRoad: TaxipressLineEntry[];
  route: { id: string; fromName: string; toName: string; directionLabel: string; farePerSeat: number } | null;
};

/** What happened when a driver confirmed a passenger's ticket at boarding. */
export type TaxipressBoardingResult = {
  bookingId: string;
  passengerName: string | null;
  seats: number;
  fare: number;
  paymentMethod: "app" | "cash";
  /** Peebee's Taxipress commission on the fare. */
  commission: number;
  /** App payment: added to the driver's wallet. Cash: what the driver keeps of the cash they collected. */
  driverAmount: number;
  /** Cash only: Peebee's cut, taken from the driver's wallet (which may go below zero). */
  takenFromDriver: number;
  driverBalance: number | null;
};

export type TaxipressReport =
  | { ready: false }
  | {
      ready: true;
      days: number;
      totals: { bookings: number; seats: number; fare: number; commission: number; platformFees: number; driverAmount: number; cashFare: number; appFare: number; takenFromDrivers: number };
      recent: Array<{ id: string; bookingId: string; paymentMethod: "app" | "cash"; seats: number; fare: number; commission: number; platformFees: number; driverAmount: number; takenFromDriver: number; createdAt: string; plate: string; driverName: string | null }>;
      /** Drivers whose wallet is below zero (cash commission taken from a wallet that could not cover it). */
      owing: Array<{ id: string; name: string | null; phone: string | null; balance: number; plate: string }>;
    };

/** The sandbox practice taxis: who to sign in as, and where the practice taxis are now. */
export type TaxipressDemoStatus = {
  installed: boolean;
  sandbox: boolean;
  walletUgx: number;
  accounts: Array<{ name: string; phone: string; email: string; role: string }>;
  line: Array<{ plate: string; status: string; seatsBooked: number; seatsTotal: number; direction: string }>;
};
