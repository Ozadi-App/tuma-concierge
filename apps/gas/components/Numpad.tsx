"use client";

import { Delete } from "lucide-react";

type NumpadProps = {
  value: string;
  onChange: (val: string) => void;
  maxLength?: number;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
};

export function Numpad({
  value,
  onChange,
  maxLength = 6,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled = false,
}: NumpadProps) {
  function handleDigit(d: string) {
    if (value.length < maxLength) {
      onChange(value + d);
    }
  }

  function handleBackspace() {
    onChange(value.slice(0, -1));
  }

  function handleClear() {
    onChange("");
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-xl font-bold text-ink shadow-sm active:scale-95 transition"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-xs font-bold text-ink-500 uppercase active:scale-95 transition"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-xl font-bold text-ink shadow-sm active:scale-95 transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink active:scale-95 transition"
        >
          <Delete className="h-6 w-6 text-ink-500" />
        </button>
      </div>

      {onConfirm && (
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={onConfirm}
          className="min-h-12 w-full rounded-2xl bg-gold text-base font-bold text-ink-gold shadow transition disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}
