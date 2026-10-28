/**
 * Request shapes for a direct card payment. The card fields are validated
 * for shape only (Luhn, length, expiry) so an obvious typo is caught before
 * a round trip to Flutterwave; the issuing bank is the real authority.
 *
 * Card data never goes into the database, a log line, or an error message.
 */

import { z } from "zod";

export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export const cardSchema = z
  .object({
    number: z.string().transform((v) => v.replace(/[\s-]/g, "")).pipe(z.string().regex(/^\d{12,19}$/, "Enter a valid card number")),
    cvv: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit security code"),
    expiryMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/, "Enter a valid expiry month"),
    expiryYear: z.string().regex(/^(\d{2}|\d{4})$/, "Enter a valid expiry year"),
  })
  .superRefine((card, ctx) => {
    if (!passesLuhn(card.number)) ctx.addIssue({ code: "custom", path: ["number"], message: "Enter a valid card number" });
    const year = card.expiryYear.length === 2 ? 2000 + Number(card.expiryYear) : Number(card.expiryYear);
    const now = new Date();
    // A card is good through the last day of its expiry month.
    if (year < now.getUTCFullYear() || (year === now.getUTCFullYear() && Number(card.expiryMonth) < now.getUTCMonth() + 1)) {
      ctx.addIssue({ code: "custom", path: ["expiryMonth"], message: "This card has expired" });
    }
  });

export const cardAuthorizationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("pin"), pin: z.string().regex(/^\d{4,6}$/, "Enter your card PIN") }),
  z.object({
    mode: z.literal("avs"),
    address: z.string().min(2).max(120),
    city: z.string().min(2).max(60),
    state: z.string().min(2).max(60),
    country: z.string().length(2).transform((v) => v.toUpperCase()),
    zipcode: z.string().min(2).max(12),
  }),
]);

export const cardContinueSchema = z.union([
  z.object({ otp: z.string().regex(/^\d{4,10}$/, "Enter the code you received"), flowRef: z.string().min(3).max(100) }),
  z.object({ card: cardSchema, authorization: cardAuthorizationSchema }),
]);
