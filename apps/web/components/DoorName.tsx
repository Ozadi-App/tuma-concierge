"use client";

import { useDoors, type DoorId } from "../lib/doors";
import { DoorLabel } from "./DoorLabel";

/** A door's name as the admin set it. The fifth door reads "Work" unless the config says otherwise. */
export function DoorName({ id, swap = false }: { id: DoorId; swap?: boolean }) {
  const door = useDoors().find((d) => d.id === id);
  if (!door) return <>{id}</>;
  return swap ? <DoorLabel door={door} /> : <>{door.label}</>;
}
