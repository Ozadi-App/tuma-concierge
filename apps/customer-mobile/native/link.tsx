"use client";

// Aliased over `next/link` in the mobile build only (see ../next.config.ts).
import NextLink from "next/dist/client/app-dir/link";
import type { ComponentProps } from "react";
import { toNative } from "./routes";

type Props = ComponentProps<typeof NextLink>;

export default function Link({ href, ...rest }: Props) {
  const resolved = typeof href === "string" ? toNative(href) : href;
  return <NextLink href={resolved} {...rest} />;
}
