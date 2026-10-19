"use client";

import { hasPermission } from "@peebee/shared";
import { useAuth } from "../../lib/auth-context";

export function useWorkPermissions() {
  const { user } = useAuth();
  const role = user?.adminRole ?? null;
  return {
    canView: hasPermission(role, "work.view"),
    canManage: hasPermission(role, "work.manage"),
    canEditSettings: hasPermission(role, "work.manage") && hasPermission(role, "settings.manage"),
  };
}

export const ugx = (n: number | null | undefined) => (n == null ? "—" : `UGX ${n.toLocaleString("en-UG")}`);

export function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso.replace(" ", "T")}${iso.includes("Z") || iso.includes("+") ? "" : "Z"}`).toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const TONE: Record<string, string> = {
  good: "bg-green/15 text-green",
  bad: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  warn: "bg-gold/15 text-ink",
  neutral: "bg-[rgb(var(--surface-muted))] text-ink-500",
};

const STATUS_TONE: Record<string, string> = {
  approved: "good", settled: "good", done: "good", completed: "good", selected: "good",
  rejected: "bad", suspended: "bad", cancelled: "bad", refunded: "bad", expired: "bad", declined: "bad",
  disputed: "warn", pending: "warn", open: "warn", quoted: "warn",
};

export function Badge({ children, tone }: { children: string; tone?: keyof typeof TONE }) {
  const t = tone ?? STATUS_TONE[children] ?? "neutral";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[t]}`}>{label(children)}</span>;
}

/** Modal confirmation. Body shows the data-driven text the caller passes in. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  error,
  disabled,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  disabled?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-[24px] bg-[rgb(var(--surface-card))] p-4 text-ink shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="space-y-3 text-sm">{children}</div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-bold text-ink">
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || disabled}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold disabled:opacity-50 ${danger ? "bg-red-600 text-white" : "bg-gold text-ink-gold"}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label: text, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-ink-500">{text}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] text-ink outline-none focus:border-gold";

export function ErrorNote({ message }: { message: string | null }) {
  return message ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{message}</p> : null;
}
