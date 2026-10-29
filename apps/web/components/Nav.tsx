"use client";

import { Home } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDoors } from "../lib/doors";
import { DOOR_CONTENT } from "../lib/content";
import { useShell } from "./ShellContext";
import { DoorLabel } from "./DoorLabel";

/**
 * The floating bar from the Peebee app: a round Home button on the left and one capsule holding the five doors.
 * Home returns to the home screen and closes any drawer. The bar is on every page except the legacy merchant tools.
 */
export function TabBar() {
  const doors = useDoors();
  const pathname = usePathname();
  const { openDoor, activeDoor, contextDoor, goHome } = useShell();
  const homeOn = pathname === "/" && !activeDoor;
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="nav-capsule">
        <button type="button" className="tab" aria-current={homeOn ? "true" : undefined} onClick={goHome}>
          <Home size={22} strokeWidth={1.9} aria-hidden />
          <span>Home</span>
        </button>
        {doors.map((d) => {
          const Icon = DOOR_CONTENT[d.id].icon;
          const on = contextDoor === d.id;
          return (
            <button key={d.id} type="button" className="tab" aria-current={on ? "true" : undefined} onClick={() => openDoor(d.id)}>
              <Icon size={22} strokeWidth={1.9} aria-hidden />
              <span><DoorLabel door={d} /></span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
