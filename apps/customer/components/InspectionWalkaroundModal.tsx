"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, Eye, RefreshCw, X } from "lucide-react";
import type { RentalInspection, RentalInspectionPhoto, RentalInspectionSlot } from "@peebee/shared";
import { api, errorMessage } from "../lib/api";

type Props = {
  rentalId: string;
  plate?: string | null;
  vehicleName?: string | null;
  phase: "pickup" | "return";
  readOnly?: boolean;
  existingInspection?: RentalInspection | null;
  comparisonInspection?: RentalInspection | null;
  onClose: () => void;
  onSuccess?: () => void;
};

type SlotConfig = {
  id: RentalInspectionSlot;
  label: string;
  desc: string;
  required: boolean;
};

const SLOTS: SlotConfig[] = [
  { id: "front", label: "Front Exterior", desc: "Front bumper, grille, headlights & hood", required: true },
  { id: "rear", label: "Rear Exterior", desc: "Rear bumper, boot, taillights & glass", required: true },
  { id: "left", label: "Left / Driver Side", desc: "Doors, windows, side mirror & wheels", required: true },
  { id: "right", label: "Right / Passenger Side", desc: "Doors, windows, mirror & wheels", required: true },
  { id: "interior", label: "Interior Cabin", desc: "Front & rear seats, dashboard, cleanliness", required: true },
  { id: "odometer", label: "Odometer Cluster", desc: "Dashboard instrument cluster showing mileage in km", required: true },
  { id: "fuel", label: "Fuel Gauge", desc: "Dashboard fuel indicator showing tank level", required: true },
  { id: "damage_extra", label: "Pre-existing Marks / Damage", desc: "Close-up of any existing dents, scratches or defects", required: false },
];

export function InspectionWalkaroundModal({
  rentalId,
  plate,
  vehicleName,
  phase,
  readOnly = false,
  existingInspection,
  comparisonInspection,
  onClose,
  onSuccess,
}: Props) {
  const [odometerKm, setOdometerKm] = useState<string>(existingInspection?.odometer_km ? String(existingInspection.odometer_km) : "");
  const [fuelPercent, setFuelPercent] = useState<number>(existingInspection?.fuel_level_percent ?? 100);
  const [generalNotes, setGeneralNotes] = useState<string>(existingInspection?.notes ?? "");
  const [photos, setPhotos] = useState<Record<RentalInspectionSlot, { dataUrl?: string; url?: string; note: string; timestamp: string }>>(() => {
    const init: Record<string, { dataUrl?: string; url?: string; note: string; timestamp: string }> = {};
    for (const slot of SLOTS) {
      const match = existingInspection?.photos.find((p) => p.slot === slot.id);
      if (match) {
        init[slot.id] = {
          url: match.url,
          note: match.note ?? "",
          timestamp: match.device_timestamp ?? match.created_at ?? "",
        };
      }
    }
    return init as Record<RentalInspectionSlot, { dataUrl?: string; url?: string; note: string; timestamp: string }>;
  });

  const [compareMode, setCompareMode] = useState(false);
  const [activeSlot, setActiveSlot] = useState<RentalInspectionSlot>("front");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = readOnly || Boolean(existingInspection && Object.keys(photos).length >= 7);

  function handlePhotoUpload(slot: RentalInspectionSlot, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos((prev) => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          dataUrl,
          note: prev[slot]?.note ?? "",
          timestamp: new Date().toISOString(),
        },
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate required slots
    for (const slot of SLOTS) {
      if (slot.required && !photos[slot.id]?.dataUrl && !photos[slot.id]?.url) {
        setError(`Please take or upload a photo for ${slot.label}.`);
        setActiveSlot(slot.id);
        return;
      }
    }

    setBusy(true);
    try {
      const photoPayload = Object.entries(photos).map(([slot, data]) => ({
        slot: slot as RentalInspectionSlot,
        dataUrl: data.dataUrl,
        note: data.note || undefined,
        deviceTimestamp: data.timestamp,
      })).filter((p) => Boolean(p.dataUrl));

      await api.submitRentalInspection(rentalId, {
        phase,
        odometerKm: odometerKm ? parseInt(odometerKm, 10) : undefined,
        fuelLevelPercent: fuelPercent,
        notes: generalNotes || undefined,
        photos: photoPayload,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const comparisonMap: Record<string, RentalInspectionPhoto> = {};
  if (comparisonInspection) {
    for (const p of comparisonInspection.photos) {
      comparisonMap[p.slot] = p;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[28px] sm:rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-faint)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold uppercase tracking-wider">
                {phase === "pickup" ? "Pickup Handover" : "Return Inspection"}
              </span>
              {comparisonInspection && (
                <button
                  type="button"
                  onClick={() => setCompareMode(!compareMode)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                    compareMode ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                  }`}
                >
                  {compareMode ? "Comparing with Pickup" : "Compare with Pickup"}
                </button>
              )}
            </div>
            <h2 className="mt-1 text-lg font-bold text-ink">
              360° Walkaround Photo Inspection
            </h2>
            <p className="text-xs text-ink-500">
              {plate || vehicleName ? `${vehicleName ?? ""} · ${plate ?? ""}` : "Vehicle walkaround verification"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspection modal"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink hover:opacity-80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Slots Progress / Navigation pills */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Inspection Steps</p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {SLOTS.map((slot) => {
                const hasPhoto = Boolean(photos[slot.id]?.dataUrl || photos[slot.id]?.url);
                const isSelected = activeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setActiveSlot(slot.id)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-gold text-ink-gold shadow-sm"
                        : hasPhoto
                        ? "bg-gold/20 text-ink"
                        : "bg-[rgb(var(--surface-muted))] text-ink-500"
                    }`}
                  >
                    {hasPhoto ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500/40" />
                    )}
                    <span>{slot.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Slot Inspection Detail */}
          {(() => {
            const currentSlot = SLOTS.find((s) => s.id === activeSlot) ?? SLOTS[0];
            const currentData = photos[currentSlot.id];
            const compData = comparisonMap[currentSlot.id];

            return (
              <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-ink">{currentSlot.label}</h3>
                    <p className="text-xs text-ink-500">{currentSlot.desc}</p>
                  </div>
                  {currentData?.timestamp && (
                    <span className="text-[11px] font-mono text-ink-500 bg-[rgb(var(--surface-card))] px-2 py-0.5 rounded-md">
                      {new Date(currentData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {/* Compare Side-by-side or Single View */}
                {compareMode && compData ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-gold uppercase tracking-wide">Pickup Photo</span>
                      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-[var(--border-faint)] bg-black/10">
                        {compData.url ? (
                          <img src={compData.url} alt={`Pickup ${currentSlot.label}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-ink-500">No pickup photo</div>
                        )}
                      </div>
                      {compData.note && <p className="text-[11px] text-ink-500 truncate">Note: {compData.note}</p>}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-bold text-ink uppercase tracking-wide">Return Photo</span>
                      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-[var(--border-faint)] bg-black/10">
                        {currentData?.dataUrl || currentData?.url ? (
                          <img
                            src={currentData.dataUrl || currentData.url}
                            alt={`Current ${currentSlot.label}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-ink-500">Pending photo</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {currentData?.dataUrl || currentData?.url ? (
                      <div className="relative aspect-16/10 w-full overflow-hidden rounded-xl border border-[var(--border-faint)] bg-black/10">
                        <img
                          src={currentData.dataUrl || currentData.url}
                          alt={currentSlot.label}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <label className="flex aspect-16/10 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 text-center transition hover:border-gold">
                        <Camera className="h-8 w-8 text-gold mb-2" strokeWidth={1.5} />
                        <span className="text-sm font-bold text-ink">Take or Upload {currentSlot.label} Photo</span>
                        <span className="mt-1 text-xs text-ink-500">JPG, PNG or WebP · Timestamp recorded automatically</span>
                        {!isComplete && (
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(currentSlot.id, file);
                            }}
                          />
                        )}
                      </label>
                    )}
                  </div>
                )}

                {/* Retake/replace button and slot note */}
                {!isComplete && (currentData?.dataUrl || currentData?.url) && (
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-bold text-ink hover:bg-gold/25">
                      <RefreshCw className="h-3.5 w-3.5 text-gold" />
                      <span>Retake photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(currentSlot.id, file);
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* Slot Specific Note */}
                {!isComplete ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-500">
                      Notes on {currentSlot.label} (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Minor hairline scratch on lower bumper edge"
                      value={currentData?.note ?? ""}
                      onChange={(e) =>
                        setPhotos((prev) => ({
                          ...prev,
                          [currentSlot.id]: {
                            ...prev[currentSlot.id],
                            note: e.target.value,
                            timestamp: prev[currentSlot.id]?.timestamp || new Date().toISOString(),
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                    />
                  </div>
                ) : currentData?.note ? (
                  <p className="text-xs text-ink-500">
                    <span className="font-semibold text-ink">Note:</span> {currentData.note}
                  </p>
                ) : null}
              </div>
            );
          })()}

          {/* Odometer & Fuel Gauge Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-ink-500">
                Odometer Reading (km)
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 48250"
                disabled={isComplete}
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-gold disabled:opacity-75"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-semibold text-ink-500">
                <span>Fuel Level</span>
                <span className="font-bold text-ink">{fuelPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={isComplete}
                value={fuelPercent}
                onChange={(e) => setFuelPercent(Number(e.target.value))}
                className="w-full accent-gold py-2"
              />
            </div>
          </div>

          {/* General Inspection Summary Note */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-500">
              General Inspection Summary / Overall Condition
            </label>
            <textarea
              rows={2}
              disabled={isComplete}
              placeholder="e.g. Vehicle in good clean condition. Spare tyre and jack present in boot."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] px-3 py-2 text-sm text-ink outline-none focus:border-gold disabled:opacity-75"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[var(--border-faint)] p-4 flex gap-3 bg-[rgb(var(--surface-card))]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-full border border-[var(--border-faint)] px-4 text-sm font-semibold text-ink hover:bg-[rgb(var(--surface-muted))]"
          >
            {isComplete ? "Close" : "Cancel"}
          </button>
          {!isComplete && (
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmit}
              className="min-h-11 flex-2 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold shadow-[0_4px_12px_rgba(201,162,39,0.35)] disabled:opacity-50"
            >
              {busy ? "Saving Inspection…" : "Submit & Confirm Inspection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
