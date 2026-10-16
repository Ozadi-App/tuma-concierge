"use client";

export type LastMileChoiceValue = "door" | "collect";

/** Relay to a petrol station: a rider to the door, or the customer collects there. */
export function LastMileChoice({
  value,
  onChange,
  stationName,
  doorTotal,
  collectTotal,
  disabled,
}: {
  value: LastMileChoiceValue;
  onChange: (value: LastMileChoiceValue) => void;
  stationName: string;
  doorTotal: number;
  collectTotal: number;
  disabled?: boolean;
}) {
  const options: Array<{ value: LastMileChoiceValue; label: string; total: number }> = [
    { value: "door", label: "Deliver to my door", total: doorTotal },
    { value: "collect", label: `I'll collect at ${stationName}`, total: collectTotal },
  ];
  return (
    <div role="radiogroup" aria-label="Last stop" className="space-y-1.5">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs disabled:opacity-60 ${
              selected ? "border-gold bg-gold/10 font-bold text-ink" : "border-[var(--border-faint)] text-ink-500"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${selected ? "border-gold bg-gold" : "border-[var(--border-faint)]"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">{option.label}</span>
            <span className="shrink-0 font-semibold text-ink">UGX {option.total.toLocaleString("en-UG")}</span>
          </button>
        );
      })}
    </div>
  );
}
