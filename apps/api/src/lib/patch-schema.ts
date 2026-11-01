import { z } from "zod";

/** An update only changes fields supplied by the caller. Zod 4's partial()
 * applies inner defaults to absent fields; the undefined branch must win
 * first to preserve our existing PATCH/partial-settings contract. Explicitly
 * supplied objects still receive their own nested defaults and validation. */
export function patchSchema<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  const shape = Object.fromEntries(Object.entries(schema.shape).map(([key, field]) =>
    [key, z.union([z.undefined(), field as z.ZodType]).optional()],
  )) as unknown as { [K in keyof S]: z.ZodOptional<S[K]> };
  return schema.extend(shape);
}
