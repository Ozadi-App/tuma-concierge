"use client";

import { SettingsListContent } from "../../components/SettingsDrawer";

export default function SettingsPage() {
  return (
    <div className="space-y-4 px-4 pb-12 pt-3 lg:px-8">
      <header className="hidden lg:block">
        <h1 className="admin-title">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Every area of Peebee, grouped. Press ⌘K to jump straight to one.</p>
      </header>
      <SettingsListContent />
    </div>
  );
}
