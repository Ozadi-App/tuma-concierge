import { configurePracticeSession, createApiClient, friendlyErrorMessage } from "@peebee/shared";

export const TOKEN_KEY = "peebee_pharmacy_token";
export const PHARMACY_STORE_KEY = "peebee_pharmacy_store";
export const PHARMACIST_KEY = "peebee_pharmacy_pharmacist";

export function getStoredToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredPharmacyId() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(PHARMACY_STORE_KEY);
}

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000",
  getToken: getStoredToken,
  onUnauthorized() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(PHARMACY_STORE_KEY);
    window.localStorage.removeItem(PHARMACIST_KEY);
  },
});

export const errorMessage = friendlyErrorMessage;

/** Practice signs in as the demo pharmacist on the shared practice world; the real session is put back on exit. */
configurePracticeSession({ api, apply: (r) => ({ [TOKEN_KEY]: r.token, [PHARMACY_STORE_KEY]: null, [PHARMACIST_KEY]: null }) });
