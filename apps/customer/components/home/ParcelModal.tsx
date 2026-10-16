"use client";

import { roundFare, type RelayQuote } from "@peebee/shared";
import { Route } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { useRegisterNavPrimaryAction, useRegisterNavBack, goBackOr } from "../../lib/nav-primary-action";
import { PlaceFlow, type PlaceResult } from "../PlaceFlow";
import { api, errorMessage } from "../../lib/api";
import { useTranslate } from "../../lib/i18n";
import { placeFields } from "../../lib/places";
import { RouteSummary } from "./RouteSummary";
import { LastMileChoice, type LastMileChoiceValue } from "../LastMileChoice";
import { OrderVoiceNoteRecorder } from "./OrderVoiceNoteRecorder";

/** Great-circle distance in km — mirrors apps/api/src/lib/geo.ts, used only
 * for the live fee preview here; the backend recomputes it authoritatively. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ParcelModal({ onClose }: { onClose: () => void }) {
  const t = useTranslate();
  const router = useRouter();
  const [route, setRoute] = useState<PlaceResult | null>(null);
  const [choosing, setChoosing] = useState(true);
  const [description, setDescription] = useState("");
  const [estimatedTotal, setEstimatedTotal] = useState("");
  const [voiceNote, setVoiceNote] = useState<Blob | null>(null);
  const [pricing, setPricing] = useState<{ ratePerKm: number; minimum: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((res) => setPricing({ ratePerKm: res.settings.deliveryRatePerKm, minimum: res.settings.minimumDeliveryFee }))
      .catch(() => {});
  }, []);

  const p = route?.pickup;
  const d = route?.destination;
  const distanceKm = p?.lat != null && p.lng != null && d?.lat != null && d.lng != null ? haversineKm(p.lat, p.lng, d.lat, d.lng) : null;
  const liveEstimate = distanceKm != null && pricing != null ? roundFare(distanceKm * pricing.ratePerKm, pricing.minimum) : null;

  // Long parcels are relayed boda -> matatu -> boda. The quote's total is
  // exactly what the order will charge, so submit waits for it.
  const quoteKey = p?.lat != null && p.lng != null && d?.lat != null && d.lng != null ? `${p.lat},${p.lng}|${d.lat},${d.lng}` : null;
  const [relayQuote, setRelayQuote] = useState<{ key: string; relay: RelayQuote | null; failed?: boolean } | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  useEffect(() => {
    if (!quoteKey || !p || !d) return;
    let cancelled = false;
    api
      .getRelayQuote({
        pickupLat: p.lat as number,
        pickupLng: p.lng as number,
        destinationLat: d.lat as number,
        destinationLng: d.lng as number,
        pickupName: p.area ?? undefined,
        destinationName: d.area ?? undefined,
      })
      .then((res) => !cancelled && setRelayQuote({ key: quoteKey, relay: res.relay }))
      .catch(() => !cancelled && setRelayQuote({ key: quoteKey, relay: null, failed: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, quoteRetry]);
  const quoteFailed = quoteKey != null && relayQuote?.key === quoteKey && relayQuote.failed === true;
  const quoteLoading = quoteKey != null && (relayQuote?.key !== quoteKey || quoteFailed);
  const relay = !quoteLoading && relayQuote ? relayQuote.relay : null;
  // Station drops: the matatu leaves it at a petrol station near the customer.
  const [lastMile, setLastMile] = useState<LastMileChoiceValue>("door");
  const station = relay?.dropMode === "station" && relay.station && relay.collectTotal != null ? relay.station : null;
  const stationChoice = station != null && relay?.choiceAtOrder === true;
  const toDoor = !station || (stationChoice && lastMile === "door");
  const relayFare = relay ? (toDoor ? relay.total : (relay.collectTotal as number)) : null;
  const relayLegs = relay ? relay.legs.filter((leg) => toDoor || leg.leg < 3) : [];
  const fare = relay ? relayFare : liveEstimate;

  // "Next: payment" is the bottom nav's right capsule (intermediate step).
  const navFare = quoteLoading ? null : fare ?? (estimatedTotal ? Number(estimatedTotal) : null);
  useRegisterNavPrimaryAction(!choosing && route ? {
    tone: "step",
    label: busy || quoteLoading ? "Please wait…" : "Next: payment",
    detail: navFare != null && Number.isFinite(navFare) && navFare > 0 ? `UGX ${navFare.toLocaleString("en-UG")}` : undefined,
    disabled: busy || quoteLoading,
    busy,
    onClick: () => void submit(),
  } : null);

  useRegisterNavBack(!choosing && !!route, () => setChoosing(true));

  if (choosing || !route) {
    return (
      <PlaceFlow
        concept="parcel"
        initial={route ?? undefined}
        onClose={() => (route ? setChoosing(false) : onClose())}
        onBack={() => (route ? setChoosing(false) : goBackOr(router, "/deliver"))}
        onDone={(r) => {
          setRoute(r);
          setChoosing(false);
        }}
      />
    );
  }

  async function submit() {
    if (!route || quoteLoading) return;
    const pf = placeFields(route.pickup);
    const df = placeFields(route.destination);
    setBusy(true);
    setError(null);
    try {
      const list = await api.createList({ title: description.trim() || "Parcel delivery" });
      const { order } = await api.createOrder({
        listId: list.listId,
        type: "parcel",
        pickupArea: pf.area,
        pickupAddress: pf.address,
        pickupLat: pf.lat,
        pickupLng: pf.lng,
        destinationArea: df.area,
        destinationAddress: df.address,
        destinationLat: df.lat,
        destinationLng: df.lng,
        paymentRail: "escrow",
        relayLastMile: stationChoice ? lastMile : undefined,
        estimatedTotal: fare ?? (estimatedTotal ? roundFare(Number(estimatedTotal), pricing?.minimum) : undefined),
      });
      if (voiceNote) {
        api.uploadOrderVoiceNote(order.id, voiceNote).catch(() => {});
      }
      onClose();
      router.push(`/orders/${order.id}/pay`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal withMap mapRoute={route} title={t("parcel_title")} onClose={onClose}>
      <div className="space-y-4">
        <RouteSummary pickup={route.pickup} destination={route.destination} destinationLabel={t("place_delivery")} onChange={() => setChoosing(true)} />

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("parcel_whats_it")}
          className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
        />

        {quoteFailed ? (
          <div className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-3">
            <p className="flex-1 text-sm text-ink-500">Couldn&apos;t get the price.</p>
            <button
              type="button"
              onClick={() => { setRelayQuote(null); setQuoteRetry((n) => n + 1); }}
              className="text-sm font-bold text-gold"
            >
              Retry
            </button>
          </div>
        ) : quoteLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-3">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden />
            <p className="text-sm text-ink-500">Getting price…</p>
          </div>
        ) : relay ? (
          <div className="space-y-2 rounded-xl border border-gold bg-gold/10 p-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
              <p className="flex-1 text-sm font-bold text-ink">Delivery</p>
              <p className="text-sm font-bold text-ink">Total UGX {(relayFare ?? relay.total).toLocaleString("en-UG")}</p>
            </div>
            <p className="text-xs text-ink-500">Long trip: relayed by boda and matatu.</p>
            {station && stationChoice ? (
              <LastMileChoice
                value={lastMile}
                onChange={setLastMile}
                stationName={station.name}
                doorTotal={relay.total}
                collectTotal={relay.collectTotal as number}
                disabled={busy}
              />
            ) : station ? (
              <p className="text-xs text-ink-500">Collect at {station.name}, or send a rider when it arrives.</p>
            ) : null}
            <ul className="space-y-1 border-t border-[var(--border-faint)] pt-2">
              {relayLegs.map((leg) => (
                <li key={leg.leg} className="flex justify-between gap-3 text-xs text-ink">
                  <span className="min-w-0">
                    <span className="font-semibold">{leg.kind === "matatu" ? "Matatu" : "Boda"}:</span> {leg.fromName} to{" "}
                    {leg.leg === 3 ? "door" : leg.toName}
                  </span>
                  <span className="shrink-0 font-semibold">{leg.fee.toLocaleString("en-UG")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : liveEstimate != null ? (
          <div className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-3">
            <Route className="h-4 w-4 shrink-0 text-gold" strokeWidth={2.25} aria-hidden />
            <p className="text-sm text-ink">
              <span className="font-bold">UGX {liveEstimate.toLocaleString("en-UG")}</span> {t("parcel_estimated")} ·{" "}
              {distanceKm!.toFixed(1)} km
            </p>
          </div>
        ) : (
          <input
            value={estimatedTotal}
            onChange={(e) => setEstimatedTotal(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder={t("parcel_estimated_fee")}
            className="w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold"
          />
        )}

        <OrderVoiceNoteRecorder blob={voiceNote} onChange={setVoiceNote} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      </div>
    </Modal>
  );
}
