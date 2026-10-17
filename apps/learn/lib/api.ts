import { createApiClient, friendlyErrorMessage } from "@peebee/shared";

export const TOKEN_KEY = "peebee_learn_token";

export function getStoredToken() {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000",
  getToken: getStoredToken,
  onUnauthorized() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
});

export const errorMessage = friendlyErrorMessage;
