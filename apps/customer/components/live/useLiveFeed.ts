"use client";

import type { LiveComment, LiveState } from "@peebee/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

const POLL_MS = 2500;
/** A viewer's heartbeat is sent every third poll, well inside the server's counting window. */
const BEAT_EVERY = 3;
const KEEP = 60;

/**
 * Polls a live stream for its viewer count and new comments. `id` can be a stream id or the id of the live post,
 * so a viewer only needs the post they are looking at. Stops by itself once the stream has ended.
 */
export function useLiveFeed(id: string | null, opts: { paused?: boolean } = {}) {
  const [state, setState] = useState<LiveState | null>(null);
  // Comments belong to one stream; switching streams starts an empty list without resetting state inside the effect.
  const [store, setStore] = useState<{ id: string | null; comments: LiveComment[] }>({ id: null, comments: [] });
  const cursor = useRef(0);
  const tick = useRef(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!id || opts.paused) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    cursor.current = 0;
    tick.current = 0;
    const setComments = (fn: (prev: LiveComment[]) => LiveComment[]) => setStore((prev) => ({ id, comments: fn(prev.id === id ? prev.comments : []) }));

    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try {
          const s = await api.liveState(id, cursor.current, tick.current % BEAT_EVERY === 0);
          tick.current += 1;
          if (cancelled) return;
          setState(s);
          if (s.cursor > cursor.current) cursor.current = s.cursor;
          if (s.comments.length) {
            setComments((prev) => {
              const known = new Set(prev.map((c) => c.id));
              return [...prev, ...s.comments.filter((c) => !known.has(c.id))].slice(-KEEP);
            });
          }
          // A comment the host hid after it was delivered: staff see it marked, viewers lose it.
          if (s.hiddenIds.length) {
            const hidden = new Set(s.hiddenIds);
            setComments((prev) => (s.canModerate ? prev.map((c) => (hidden.has(c.id) && !c.hidden ? { ...c, hidden: true } : c)) : prev.filter((c) => !hidden.has(c.id))));
          }
          if (s.status === "ended") return;
        } catch {
          /* a missed poll is fine; the next one catches up */
        }
      }
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [id, opts.paused, version]);

  /** Adds a comment to the list at once (a person's own comment), and drops one the host hid. */
  const patch = (fn: (prev: LiveComment[]) => LiveComment[]) => setStore((prev) => ({ id, comments: fn(prev.id === id ? prev.comments : []) }));
  return { state, comments: store.id === id ? store.comments : [], patch, refresh: () => setVersion((v) => v + 1) };
}
