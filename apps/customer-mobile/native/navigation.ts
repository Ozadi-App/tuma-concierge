"use client";

// Aliased over `next/navigation` in the mobile build only (see ../next.config.ts).
// Re-exports everything, overriding the hooks that see dynamic-route URLs.
import {
  usePathname as useRealPathname,
  useRouter as useRealRouter,
  useSearchParams as useRealSearchParams,
} from "next/dist/client/components/navigation";
import { useMemo } from "react";
import { fromNative, toNative } from "./routes";

export * from "next/dist/client/components/navigation";

export function useRouter() {
  const router = useRealRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(toNative(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(toNative(href), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(toNative(href), options),
    }),
    [router],
  );
}

export function useSearchParams() {
  const search = useRealSearchParams();
  return useMemo(() => fromNative("/", new URLSearchParams(search.toString())).search, [search]);
}

export function usePathname() {
  const pathname = useRealPathname();
  const search = useRealSearchParams();
  return useMemo(
    () => fromNative(pathname, new URLSearchParams(search.toString())).pathname,
    [pathname, search],
  );
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const search = useRealSearchParams();
  return useMemo(() => fromNative("/", new URLSearchParams(search.toString())).params as T, [search]);
}
