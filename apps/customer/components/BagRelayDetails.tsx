"use client";

import type { BagRelay } from "../lib/bag-quote";
import { relayLegLabel } from "./OrderBreakdown";
import { LastMileChoice, pickMeetStageId, type LastMileChoiceValue } from "./LastMileChoice";

/** Whether the bag's relay asks the customer to choose now (door/collect, or meeting the matatu at a stage). */
export function bagRelayHasChoice(relay: BagRelay | null): boolean {
  return (
    !!relay && relay.dropMode === "station" && !!relay.station && relay.collectTotal != null &&
    (relay.choiceAtOrder || (relay.meetStages?.length ?? 0) > 0)
  );
}

/** The last-mile fields to send with a bag quote or checkout. */
export function bagRelayLastMileInput(
  relay: BagRelay | null,
  lastMile: LastMileChoiceValue,
  meetStageId: string | null | undefined,
): { relayLastMile?: LastMileChoiceValue; relayMeetStageId?: string } {
  if (!bagRelayHasChoice(relay)) return {};
  if (lastMile === "meet") {
    const id = pickMeetStageId(relay?.meetStages, meetStageId);
    return id ? { relayLastMile: "meet", relayMeetStageId: id } : { relayLastMile: "door" };
  }
  return { relayLastMile: lastMile };
}

/** The legs of a relayed bag delivery, and the door/collect choice for a petrol-station drop. */
export function BagRelayDetails({
  relay,
  lastMile,
  onLastMileChange,
  meetStageId,
  onMeetStageChange,
  disabled,
  pickups = [],
  className = "",
}: {
  relay: BagRelay;
  /** Stores in the bag (kept for callers; `pickups` names them). */
  storeCount?: number;
  /** The stores' names, in pickup order: the first boda leg names them all. */
  pickups?: string[];
  lastMile: LastMileChoiceValue;
  onLastMileChange: (value: LastMileChoiceValue) => void;
  meetStageId?: string | null;
  onMeetStageChange?: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const station = relay.dropMode === "station" && relay.station ? relay.station : null;
  const choice = bagRelayHasChoice(relay);
  const meeting = choice && lastMile === "meet" && (relay.meetStages?.length ?? 0) > 0;
  const toDoor = !station || (choice && relay.choiceAtOrder ? lastMile === "door" : !meeting && relay.lastMile === "door");
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
          choiceAtOrder={relay.choiceAtOrder}
          meetStages={relay.meetStages}
          meetStageId={meetStageId}
          onMeetStageChange={onMeetStageChange}
          disabled={disabled}
        />
      ) : station && !toDoor ? (
        <p>Collect at {station}, or send a rider when it arrives.</p>
      ) : null}
      {legs.map((leg, i) => {
        // The same labels as the pay screen: the first boda names every store, the matatu its direction.
        const label = relayLegLabel(
          { ...leg, distanceKm: leg.distanceKm ?? null, direction: leg.kind === "matatu" ? relay.direction ?? null : undefined },
          i,
          legs.length,
          pickups,
          toDoor,
        );
        return (
          <div key={leg.leg} className="flex justify-between gap-3">
            <span className="min-w-0">{label}</span>
            <span className="shrink-0">UGX {leg.fee.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
