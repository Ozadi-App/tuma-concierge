import { createApiClient, createPracticeFetch, friendlyErrorMessage } from "@peebee/shared";

export const TOKEN_KEY = "peebee_gas_token";
export const ATTENDANT_KEY = "peebee_gas_attendant";
export const MANAGER_KEY = "peebee_gas_manager";
export const ROLE_KEY = "peebee_gas_role";
export const MODE_KEY = "peebee_gas_mode";
export const OUTLET_KEY = "peebee_gas_outlet";

export function getStoredToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredOutletId() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(OUTLET_KEY);
}

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000",
  fetchImpl: createPracticeFetch("gas"),
  getToken: getStoredToken,
  onUnauthorized() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ATTENDANT_KEY);
    window.localStorage.removeItem(MANAGER_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(MODE_KEY);
    if (window.location.pathname !== "/login") window.location.href = "/login";
  },
});

export const errorMessage = friendlyErrorMessage;
