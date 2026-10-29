"use client";

import { MobileHomeMore } from "./MobileHomeMore";
import { useDoors } from "../lib/doors";
import { DOOR_CONTENT } from "../lib/content";
import { PHOTOS } from "../lib/photos";
import { useShell } from "./ShellContext";

/** Phone and tablet home. It follows the Peebee app's home, with the five doors as picture tiles. */
export function AppHome() {
  const doors = useDoors();
  const { openDoor } = useShell();
  return (
    <div className="app-home">
      <section className="m-hero">
        <h1>Everything Kampala does in a day, in one app.</h1>
        <p>Ride across town, send the list to the market, order dinner from a kitchen you love, sit a class, get the house cleaned. Pay once from a wallet that holds the money until the job is done.</p>
      </section>

      <ul className="tiles">
        {doors.map((d, i) => {
          const c = DOOR_CONTENT[d.id];
          return (
            <li key={d.id} className="tile-li" data-n={i}>
              <button type="button" className="tile" onClick={() => openDoor(d.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PHOTOS[d.id].card} alt="" loading={i < 2 ? "eager" : "lazy"} />
                <span className="tile-shade" />
                <span className="tile-chip"><c.icon size={18} aria-hidden /></span>
                <span className="tile-text">
                  <b>{d.label}</b>
                </span>
              </button>
              <p className="tile-desc">{c.tile}</p>
            </li>
          );
        })}
      </ul>

      <MobileHomeMore />
    </div>
  );
}
