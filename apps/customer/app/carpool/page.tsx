"use client";

import { Select } from "@peebee/shared/select";
import type { CarpoolTrip } from "@peebee/shared";
import { CalendarDays, ChevronLeft, Crown, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useRegisterNavPrimaryAction } from "../../lib/nav-primary-action";
import { PlaceSearch, type FoundPlace } from "../../components/PlaceSearch";
import { api, errorMessage } from "../../lib/api";
import { cachedPosition } from "../../lib/places";

const ugx = (n: number) => `UGX ${Number(n).toLocaleString("en-UG")}`;
const field = "w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold";

export default function CarpoolPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState<FoundPlace | null>(null);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originNeedsSelection, setOriginNeedsSelection] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"finding" | "ready" | "manual">("finding");
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<CarpoolTrip[] | null>(null);
  const [visibleTripCount, setVisibleTripCount] = useState(8);
  const [maxSeats, setMaxSeats] = useState(3);
  const [seats, setSeats] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const findTrips = useCallback(async (pickup: FoundPlace, departureDate = "") => {
    setBusy("search");
    setError("");
    try {
      const result = await api.carpoolSearch({ nearLat: pickup.lat, nearLng: pickup.lng, nearLabel: pickup.label, date: departureDate || undefined });
      setTrips(result.trips);
      setVisibleTripCount(8);
      setMaxSeats(result.maxSeatsPerBooking);
    } catch (err) {
      setError(errorMessage(err));
      setTrips(null);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const cached = cachedPosition();
    if (cached) {
      const pickup = { label: cached.label || "Current location", lat: cached.lat, lng: cached.lng };
      setOrigin(pickup);
      setLocationStatus("ready");
      void findTrips(pickup);
    } else if (navigator.geolocation) {
      setLocationStatus("finding");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return;
          const pickup = { label: "Current location", lat: position.coords.latitude, lng: position.coords.longitude };
          setOrigin(pickup);
          setLocationStatus("ready");
          void findTrips(pickup);
        },
        () => {
          if (active) { setLocationStatus("manual"); setEditingOrigin(true); }
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 },
      );
    } else {
      setLocationStatus("manual");
      setEditingOrigin(true);
    }
    return () => { active = false; };
  }, [findTrips]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!origin) {
      setError("Choose a pickup area to see nearby trips.");
      return;
    }
    setEditingOrigin(false);
    setLocationStatus("ready");
    await findTrips(origin, date);
  }

  async function book(trip: CarpoolTrip) {
    const count = Math.min(seats[trip.id] ?? 1, trip.seatsLeft, maxSeats);
    setBusy(trip.id);
    setError("");
    try {
      const { order } = await api.carpoolBook(trip.id, count);
      router.push(`/orders/${order.id}/pay`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  // The search step is the bottom nav's right capsule (white/grey step button),
  // not an in-form button. Booking a specific trip stays on its own card.
  useRegisterNavPrimaryAction({
    tone: "step",
    label: busy === "search" ? "Finding trips…" : trips ? "Search again" : "Show nearby trips",
    disabled: !origin || originNeedsSelection || busy === "search",
    busy: busy === "search",
    onClick: () => void search(),
  });

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-500">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink">Rideshare</h1>
          <p className="text-sm text-ink-500">Find a shared trip leaving near you.</p>
        </div>
      </div>

      <form onSubmit={search} className="home-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"><MapPin className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pickup area</p>
              {origin && !editingOrigin ? (
                <p aria-live="polite" className="truncate font-semibold text-ink">{origin.label}</p>
              ) : locationStatus === "finding" ? (
                <p className="text-sm text-ink-500">Finding your location…</p>
              ) : (
                <p className="text-sm text-ink-500">Choose where you want to leave from.</p>
              )}
            </div>
          </div>
          {origin && !editingOrigin && (
            <button type="button" onClick={() => setEditingOrigin(true)} className="shrink-0 text-sm font-semibold text-gold">Change</button>
          )}
        </div>

        {editingOrigin && (
          <div className="space-y-2">
            <PlaceSearch key={origin ? `${origin.lat}:${origin.lng}` : "empty"} label="Search pickup area" value={origin} onPick={(place) => { if (place) { setOrigin(place); setOriginNeedsSelection(false); setLocationStatus("ready"); } else setOriginNeedsSelection(true); }} />
            {origin && <button type="button" onClick={() => { setOriginNeedsSelection(false); setEditingOrigin(false); }} className="text-sm font-semibold text-ink-500">Keep current area</button>}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-semibold text-ink-500">
          <CalendarDays className="h-4 w-4" /> Departure date <span className="font-normal">(optional)</span>
        </label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {busy === "search" && trips === null && <p role="status" className="text-sm text-ink-500">Checking for available trips near you…</p>}
      {trips && trips.length === 0 && (
        <section className="home-card space-y-1 text-center">
          <p className="font-semibold text-ink">No available trips nearby yet</p>
          <p className="text-sm text-ink-500">Try another date or pickup area, or check back soon.</p>
        </section>
      )}
      {trips?.slice(0, visibleTripCount).map((trip) => {
        const count = Math.min(seats[trip.id] ?? 1, trip.seatsLeft, maxSeats);
        return (
          <section key={trip.id} className={`home-card space-y-3 overflow-hidden ${trip.isVip ? "border border-gold/40 shadow-[0_4px_18px_rgba(234,179,8,0.1)]" : ""}`}>
            {trip.image && (
              <div className="-mx-4 -mt-4 mb-2 aspect-[16/9] w-[calc(100%+2rem)] overflow-hidden bg-slate-900 border-b border-[var(--border-faint)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trip.image} alt={trip.vehicle} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-bold text-ink">{trip.originLabel} <span className="text-gold">→</span> {trip.destLabel}</p>
                <p className="mt-1 text-sm text-ink-500">{new Date(trip.departAt).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              {trip.isVip && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-black text-ink-gold border border-gold/40">
                  <Crown className="h-3 w-3 text-gold fill-gold" /> VIP
                </span>
              )}

            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-faint)] pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{trip.driverName}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {trip.plate && (
                    <span className="inline-flex items-center rounded border border-amber-500 bg-amber-400 px-1.5 py-0.2 font-mono text-[10px] font-black text-black">
                      {trip.plate}
                    </span>
                  )}
                  <p className="truncate text-xs text-ink-500">{trip.vehicle} · {trip.seatsLeft} seat{trip.seatsLeft === 1 ? "" : "s"} left</p>
                </div>
                {trip.townDailyUgx && (
                  <p className="text-[11px] text-ink-500 mt-1">
                    Rate: UGX {trip.townDailyUgx.toLocaleString("en-UG")}/day (Town) · UGX {(trip.upcountryDailyUgx ?? Math.round(trip.townDailyUgx * 1.3)).toLocaleString("en-UG")}/day (Upcountry)
                  </p>
                )}
              </div>
              <p className="shrink-0 text-right text-sm font-bold text-ink">{ugx(trip.seatPrice)}<span className="block text-xs font-normal text-ink-500">per seat</span></p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={count} onValueChange={(value) => setSeats((current) => ({ ...current, [trip.id]: Number(value) }))} aria-label="Seats" className="rounded-xl border border-[var(--border-faint)] px-2 py-2 text-sm">
                {Array.from({ length: Math.min(trip.seatsLeft, maxSeats) }, (_, index) => index + 1).map((number) => (
                  <option key={number} value={number}>{number} seat{number === 1 ? "" : "s"}</option>
                ))}
              </Select>
              <button type="button" disabled={busy === trip.id} onClick={() => book(trip)} className="min-h-11 flex-1 rounded-full bg-gold px-3 font-bold text-ink-gold disabled:opacity-60">
                {busy === trip.id ? "Please wait…" : `Book · ${ugx(trip.seatPrice * count)}`}
              </button>
            </div>
          </section>
        );
      })}
      {trips && trips.length > visibleTripCount && <button type="button" onClick={() => setVisibleTripCount((count) => count + 8)} className="min-h-11 w-full rounded-full border border-[var(--border-faint)] text-sm font-semibold text-ink">Show more trips ({trips.length - visibleTripCount} remaining)</button>}
    </div>
  );
}
