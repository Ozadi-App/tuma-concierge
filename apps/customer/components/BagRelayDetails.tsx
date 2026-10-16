"use client";

import type { BagRelay } from "../lib/bag-quote";
import { LastMileChoice, type LastMileChoiceValue } from "./LastMileChoice";

/** Whether the bag's relay asks the customer to pick door or collect now. */
export function bagRelayHasChoice(relay: BagRelay | null): boolean {
  return !!relay && relay.dropMode === "station" && !!relay.station && relay.collectTotal != null && relay.choiceAtOrder;
}

/** The legs of a relayed bag delivery, and the door/collect choice for a petrol-station drop. */
export function BagRelayDetails({
  relay,
  lastMile,
  onLastMileChange,
  disabled,
  className = "",
}: {
  relay: BagRelay;
  lastMile: LastMileChoiceValue;
  onLastMileChange: (value: LastMileChoiceValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const station = relay.dropMode === "station" && relay.station ? relay.station : null;
  const choice = bagRelayHasChoice(relay);
  const toDoor = !station || (choice ? lastMile === "door" : relay.lastMile === "door");
  const legs = [...relay.legs].sort((a, b) => a.leg - b.leg).filter((leg) => toDoor || leg.leg < 3);
  return (
    <div className={`space-y-1.5 text-[11px] text-ink-500 ${className}`}>
      <p>Long trip: relayed by boda and matatu.</p>
      {station && choice ? (
        <LastMileChoice
          value={lastMile}
          onChange={onLastMileChange}
          stationName={station}
          doorTotal={relay.doorTotal}
          collectTotal={relay.collectTotal as number}
          disabled={disabled}
        />
      ) : station && !toDoor ? (
        <p>Collect at {station}, or send a rider when it arrives.</p>
      ) : null}
      {legs.map((leg) => (
        <div key={leg.leg} className="flex justify-between gap-3">
          <span className="min-w-0">
            {leg.kind === "matatu" ? "Matatu" : "Boda"}: {leg.fromName} to {leg.leg === 3 ? "door" : leg.toName}
          </span>
          <span className="shrink-0">UGX {leg.fee.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
