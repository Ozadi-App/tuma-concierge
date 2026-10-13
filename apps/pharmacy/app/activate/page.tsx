"use client";

import { ActivationPage } from "@peebee/shared/activation";
import { TOKEN_KEY } from "../../lib/api";

export default function Activate() {
  return (
    <ActivationPage
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"}
      accountType="pharmacy"
      onActivated={(token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, token);
          window.location.replace("/");
        }
      }}
    />
  );
}
