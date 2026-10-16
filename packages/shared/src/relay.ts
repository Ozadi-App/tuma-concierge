/** Relay delivery: a long parcel goes boda -> matatu -> boda. See apps/api/src/relay. */

export type RelayLegKind = "boda" | "matatu";
export type RelayLegStatus = "waiting" | "open" | "assigned" | "in_transit" | "arrived" | "done";

export type RelayQuote = {
  routeName: string;
  total: number;
  legs: Array<{ leg: 1 | 2 | 3; kind: RelayLegKind; fromName: string; toName: string; distanceKm: number; fee: number }>;
};

/** The relay as the order page shows it. handoffCode is only sent to whoever is handing the parcel over. */
export type OrderRelay = {
  routeName: string | null;
  legs: Array<{
    id: string;
    leg: 1 | 2 | 3;
    kind: RelayLegKind;
    fromName: string | null;
    fromLat: number | null;
    fromLng: number | null;
    toName: string | null;
    toLat: number | null;
    toLng: number | null;
    distanceKm: number | null;
    fee: number;
    status: RelayLegStatus;
    providerName: string | null;
    vehiclePlate: string | null;
    startedAt: string | null;
    handedOverAt: string | null;
    handoffCode?: string;
  }>;
};

export type RelayOpenLeg = {
  id: string;
  order_id: string;
  from_name: string;
  from_lat: number;
  from_lng: number;
  to_name: string;
  distance_km: number;
  fee: number;
  created_at: string;
  destination_area: string | null;
  destination_address: string | null;
  matatu_status: RelayLegStatus | null;
  vehicle_plate: string | null;
};

export type RelayRoute = {
  id: string;
  name: string;
  stage_a_name: string;
  stage_a_lat: number;
  stage_a_lng: number;
  stage_b_name: string;
  stage_b_lat: number;
  stage_b_lng: number;
  parcel_fare: number;
  active: number;
  operators?: number;
};

export type RelayOperator = {
  user_id: string;
  route_id: string | null;
  route_name: string | null;
  vehicle_plate: string;
  phone: string | null;
  status: "pending" | "approved" | "suspended";
  name?: string;
  account_phone?: string | null;
  parcels?: number;
  created_at: string;
  updated_at: string;
};

export type RelayOperatorParcels = {
  carrying: Array<{ id: string; order_id: string; from_name: string; to_name: string; status: RelayLegStatus; handoff_code: string; started_at: string; last_mile_status: RelayLegStatus | null; last_rider_name: string | null }>;
  incoming: Array<{ order_id: string; stage_name: string; stage: string; rider_name: string | null }>;
  recent: Array<{ id: string; order_id: string; from_name: string; to_name: string; handed_over_at: string; paid_amount: number | null }>;
};

export type RelaySettings = {
  enabled: boolean;
  minDistanceKm: number;
  maxAccessKm: number;
  lastMileRadiusKm: number;
  releasePerLeg: boolean;
};

export type RelayAdminOrder = {
  id: string;
  stage: string;
  createdAt: string;
  environment: string;
  legs: Array<{ leg: number; kind: RelayLegKind; fromName: string; toName: string; fee: number; status: RelayLegStatus; providerName: string | null; handedOverAt: string | null; paidAmount: number | null; paidAt: string | null }>;
};
