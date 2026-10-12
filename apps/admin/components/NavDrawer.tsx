"use client";

import { SettingsDrawer } from "./SettingsDrawer";

export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <SettingsDrawer open={open} onClose={onClose} />;
}
