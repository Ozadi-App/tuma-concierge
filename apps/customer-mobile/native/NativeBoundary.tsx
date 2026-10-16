"use client";

import { Suspense } from "react";

// The route params live in the query string, which a static export can only
// read behind a Suspense boundary. The build wraps the root layout's <body>
// contents in this (scripts/build.mjs).
export function NativeBoundary({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
