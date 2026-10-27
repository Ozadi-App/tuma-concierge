import { configurePracticeSession, createApiClient, friendlyErrorMessage } from "@peebee/shared";

export const TOKEN_KEY = "peebee_work_token";

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
    if (window.location.pathname !== "/login") window.location.href = "/login";
  },
});

export const errorMessage = friendlyErrorMessage;

/** Practice signs in as a demo service provider on the shared practice world; the real session is put back on exit. */
configurePracticeSession({ api, apply: (r) => ({ [TOKEN_KEY]: r.token }) });
