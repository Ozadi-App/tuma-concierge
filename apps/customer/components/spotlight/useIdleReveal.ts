"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Overlays rest semi-transparent; any tap, mouse movement or focus makes them
 * fully opaque, and they fade back after `idleMs` without interaction (or as
 * soon as the mouse leaves). Spread `bind` on the media container and put
 * `data-active={active}` on an ancestor of the `.sl-idle` elements. */
export function useIdleReveal(idleMs = 3500) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), idleMs);
  }, [idleMs]);

  const rest = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setActive(false);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const bind = {
    onPointerDown: poke,
    onPointerMove: (e: React.PointerEvent) => { if (e.pointerType === "mouse") poke(); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") rest(); },
    onFocusCapture: poke,
    onKeyDown: poke,
  };

  return { active, poke, rest, bind };
}
