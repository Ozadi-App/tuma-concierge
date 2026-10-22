/**
 * The people of the practice world. Everyone who practises signs in as one of these, never as themselves, so their own
 * account, wallet and history are untouched and practice always starts from the same place.
 *
 * Ids start with `prac_`: nothing in the live database uses that prefix, and a practice token only ever reaches the
 * practice database, so the two can never be confused.
 */
export type PracticeRole = "customer" | "rider" | "merchant" | "restaurant" | "pharmacy" | "gas" | "learner" | "educator" | "provider" | "worker";

export const PRACTICE_ROLES: readonly PracticeRole[] = ["customer", "rider", "merchant", "restaurant", "pharmacy", "gas", "learner", "educator", "provider", "worker"];

export type PracticeCustomer = { id: string; name: string; phone: string; areaAddress: string; lat: number; lng: number; walletUgx: number };

/** The people who buy. Each lives somewhere different around Entebbe, so riders and merchants see a spread of orders. */
export const PRACTICE_CUSTOMERS: readonly PracticeCustomer[] = [
  { id: "prac_cust_amina", name: "Amina Nakato", phone: "0790000101", areaAddress: "Kitoro, Entebbe", lat: 0.0558, lng: 32.4692, walletUgx: 250_000 },
  { id: "prac_cust_brian", name: "Brian Ssebunya", phone: "0790000102", areaAddress: "Bugonga, Entebbe", lat: 0.0497, lng: 32.4574, walletUgx: 180_000 },
  { id: "prac_cust_grace", name: "Grace Atim", phone: "0790000103", areaAddress: "Katabi, Entebbe", lat: 0.0762, lng: 32.4531, walletUgx: 320_000 },
  { id: "prac_cust_joseph", name: "Joseph Kizza", phone: "0790000104", areaAddress: "Nakiwogo, Entebbe", lat: 0.0468, lng: 32.4709, walletUgx: 120_000 },
  { id: "prac_cust_sarah", name: "Sarah Namuli", phone: "0790000105", areaAddress: "Lunyo, Entebbe", lat: 0.0364, lng: 32.4816, walletUgx: 95_000 },
  { id: "prac_cust_peter", name: "Peter Okello", phone: "0790000106", areaAddress: "Abaita Ababiri, Entebbe", lat: 0.0412, lng: 32.4423, walletUgx: 210_000 },
];

/** The signed-in identity for each role when someone starts practising. */
export const PRACTICE_PERSONA_FOR_ROLE: Record<PracticeRole, string> = {
  customer: "prac_cust_amina",
  rider: "prac_rider_1",
  merchant: "prac_mu_pe_lakeside_mart",
  restaurant: "prac_ro_lakeview",
  pharmacy: "prac_mu_pe_lakeview_pharmacy",
  /** A pump attendant has no user account: the persona is the attendant row, signed in with a pump session. */
  gas: "prac_fa_1_1",
  learner: "prac_learn_1",
  /** The head of Hilltop Junior Academy, from the Learn demo educators. */
  educator: "usr_demo_hilltop",
  /** Found when the session starts: the first demo Work provider and the first demo Hire worker. */
  provider: "",
  worker: "",
};

export const isPracticeId = (id: string): boolean => id.startsWith("prac_");
