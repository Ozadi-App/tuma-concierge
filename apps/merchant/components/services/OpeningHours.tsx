"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Window = { weekday: number; open_time: string; close_time: string };
type Blackout = { blackout_date: string; reason: string };

/** Weekly opening hours and days off. Customers can only pick times inside these when the platform runs on open slots. */
export function OpeningHours({ token }: { token: string | null }) {
  const [hours, setHours] = useState<Window[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");
  const [note, setNote] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`${API_BASE}/v1/services-platform/hours`, { headers, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setHours((d.hours ?? []).map((h: Window) => ({ weekday: Number(h.weekday), open_time: String(h.open_time), close_time: String(h.close_time) })));
    setBlackouts(d.blackouts ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    const r = await fetch(`${API_BASE}/v1/services-platform/hours`, { method: "PUT", headers, body: JSON.stringify({ hours }) });
    const d = await r.json().catch(() => ({}));
    setNote(r.ok ? "Opening hours saved." : d.message || "Could not save the hours.");
  }

  async function addOff() {
    if (!offDate) return;
    const r = await fetch(`${API_BASE}/v1/services-platform/blackouts`, { method: "POST", headers, body: JSON.stringify({ date: offDate, reason: offReason }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNote(d.message || "Could not add that day off.");
    setOffDate("");
    setOffReason("");
    await load();
  }

  async function removeOff(date: string) {
    await fetch(`${API_BASE}/v1/services-platform/blackouts/${date}`, { method: "DELETE", headers });
    await load();
  }

  const update = (index: number, patch: Partial<Window>) => setHours((list) => list.map((h, i) => (i === index ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-black text-ink">Opening hours</h3>
        <p className="text-xs text-ink-500">Customers choose from these times. A day with no hours is closed.</p>
      </div>
      <div className="space-y-4">
        {DAYS.map((day, weekday) => (
          <div key={day} className="rounded-2xl border border-ink/10 bg-surface-primary p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">{day}</span>
              <button type="button" onClick={() => setHours((l) => [...l, { weekday, open_time: "09:00", close_time: "17:00" }])} className="text-xs font-bold text-gold">+ Add hours</button>
            </div>
            {hours.map((h, i) => h.weekday !== weekday ? null : (
              <div key={i} className="mt-2 flex items-center gap-2 text-xs">
                <div className="field-box rounded-xl"><input type="time" value={h.open_time} onChange={(e) => update(i, { open_time: e.target.value })} className="p-2 text-xs text-ink outline-none" /></div>
                <span className="text-ink-400">to</span>
                <div className="field-box rounded-xl"><input type="time" value={h.close_time} onChange={(e) => update(i, { close_time: e.target.value })} className="p-2 text-xs text-ink outline-none" /></div>
                <button type="button" onClick={() => setHours((l) => l.filter((_, j) => j !== i))} className="font-bold text-red-600">Remove</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button type="button" onClick={save} className="rounded-xl bg-gold px-5 py-2.5 text-xs font-black text-black shadow hover:bg-gold-light">Save opening hours</button>

      <div className="space-y-2 border-t border-ink/10 pt-4">
        <h3 className="text-sm font-black text-ink">Days off</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="field-box rounded-xl"><input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} className="p-2 text-xs text-ink outline-none" /></div>
          <div className="field-box rounded-xl"><input type="text" placeholder="Reason (optional)" value={offReason} onChange={(e) => setOffReason(e.target.value)} className="p-2 text-xs text-ink outline-none" /></div>
          <button type="button" onClick={addOff} className="rounded-xl bg-ink px-4 py-2 font-bold text-cream">Add day off</button>
        </div>
        {blackouts.map((b) => (
          <div key={b.blackout_date} className="flex items-center justify-between rounded-xl border border-ink/10 bg-surface-primary px-3 py-2 text-xs">
            <span><strong>{b.blackout_date}</strong>{b.reason ? ` · ${b.reason}` : ""}</span>
            <button type="button" onClick={() => removeOff(b.blackout_date)} className="font-bold text-red-600">Remove</button>
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-ink-600">{note}</p>}
    </div>
  );
}
