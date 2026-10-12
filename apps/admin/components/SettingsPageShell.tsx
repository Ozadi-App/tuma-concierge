"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function SettingsPageShell({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink transition active:opacity-60"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </Link>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
      </div>
      {loading ? <p className="text-sm text-ink-500">Loading…</p> : children}
    </div>
  );
}

export function SettingsSaveBar({
  busy,
  error,
  saved,
}: {
  busy: boolean;
  error: string | null;
  saved: boolean;
}) {
  return (
    <>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {saved && <p className="text-sm font-medium text-green">Saved.</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-[20px] bg-gold px-4 text-sm font-bold text-ink-gold shadow transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </>
  );
}
