"use client";

import { Switch } from "../ui/Switch";
import { hasPermission } from "@peebee/shared";
import { useAuth } from "../../lib/auth-context";

export { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, ugx, when } from "../work/ui";

export function useTalentPermissions() {
  const { user } = useAuth();
  const role = user?.adminRole ?? null;
  return { canView: hasPermission(role, "talent.view"), canManage: hasPermission(role, "talent.manage") };
}

export function Toggle({ label: text, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold text-ink">{text}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold disabled:opacity-60 ${on ? "border-gold bg-gold/15 text-ink" : "border-[var(--border-faint)] text-ink-500"}`}>
      {children}
    </button>
  );
}
