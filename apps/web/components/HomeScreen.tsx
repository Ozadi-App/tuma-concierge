"use client";

import { AppHome } from "./AppHome";
import { DesktopLanding } from "./DesktopLanding";
import { DesktopDoorPage } from "./DesktopDoorPage";
import { useShell } from "./ShellContext";

/** Phone/tablet: the app home (a door opens as a drawer over it). Desktop: the landing, or a door's own page. */
export function HomeScreen() {
  const { activeDoor } = useShell();
  return (
    <>
      <div className="app-only">
        <AppHome />
      </div>
      <div className="desk-only">
        {activeDoor ? <DesktopDoorPage id={activeDoor} /> : <DesktopLanding />}
      </div>
    </>
  );
}
