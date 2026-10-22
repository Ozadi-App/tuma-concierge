"use client";

import { ChevronRight, LogOut, Store, User } from "lucide-react";
import Link from "next/link";
import { AppearanceSettings } from "../../components/AppearanceSettings";
import { ChangePasswordPanel } from "../../components/ChangePasswordPanel";
import { LanguageSettings } from "../../components/LanguageSettings";
import { PracticeModeCard } from "../../components/PracticeMode";
import { Card, PageHeader } from "../../components/ui/Page";
import { useAuth } from "../../lib/auth-context";

/** Personal settings. The business itself lives in Business profile. */
export default function AccountPage() {
  const { user, restaurant, logout } = useAuth();
  return (
    <div className="space-y-5 px-4 pb-6 pt-4 lg:px-8">
      <PageHeader eyebrow="Account" title="Settings" description="Your sign-in, language and practice mode." />
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"><User className="h-6 w-6" strokeWidth={1.75} aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ink">{user?.name ?? "—"}</span>
            <span className="block text-sm text-ink-500">{user?.phone ?? user?.email}</span>
          </span>
        </div>
        <Link href="/business" className="rs-list-row -mx-2 rounded-2xl !min-h-12 hover:bg-[rgb(var(--surface-muted))]">
          <span className="rs-list-icon"><Store size={18} aria-hidden /></span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{restaurant ? restaurant.name : "Register your food business"}<span className="block text-xs font-normal text-ink-500">Business profile, hours, photos, theme</span></span>
          <ChevronRight size={16} className="text-ink-500" aria-hidden />
        </Link>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <PracticeModeCard role="restaurant" />
          {!restaurant && <AppearanceSettings />}
          <LanguageSettings />
        </div>
        <div className="space-y-5">
          <ChangePasswordPanel />
          <button onClick={logout} className="rs-btn rs-btn-ghost w-full"><LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />Log out</button>
        </div>
      </div>
    </div>
  );
}
