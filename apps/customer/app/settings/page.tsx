"use client";

import { AppearanceSettings } from "../../components/AppearanceSettings";
import { ChangePasswordPanel } from "../../components/ChangePasswordPanel";
import { LanguageSettings } from "../../components/LanguageSettings";
import { MatchingPreference } from "../../components/MatchingPreference";
import { NotificationSettings } from "../../components/NotificationSettings";

export default function SettingsPage() {
  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-bold text-ink">Settings</h1>
      <AppearanceSettings />
      <NotificationSettings />
      <LanguageSettings />
      <MatchingPreference />
      <ChangePasswordPanel />
    </div>
  );
}
