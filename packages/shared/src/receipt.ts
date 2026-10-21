/** What scanning the QR on a Peebee receipt (or typing its reference) answers. */
export type PublicReceipt = {
  valid: true;
  kind: "fuel" | "taxipress";
  title: string;
  /** What the receipt is, line by line, ready to show. */
  lines: Array<{ label: string; value: string }>;
  amountUgx: number;
  issuedAt: string;
  /** Issued in the sandbox, so it is practice money. */
  demo: boolean;
};

/** The customer site's address, where a receipt's QR sends whoever scans it with an ordinary phone camera. */
export const CUSTOMER_APP_URL = "https://app.peebee.online";

/** The link a receipt's QR holds; the receipt reference is the last part, and scanners in the apps read just that. */
export function receiptUrl(ref: string, origin: string = CUSTOMER_APP_URL): string {
  return `${origin.replace(/\/$/, "")}/receipt/${encodeURIComponent(ref)}`;
}
