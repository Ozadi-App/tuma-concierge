"use client";

import type { PharmacyPrescription } from "@peebee/shared";
import { AlertCircle, Camera, CheckCircle2, MapPin, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, errorMessage } from "../../lib/api";
import { compressImage } from "../../lib/image-compress";
import { useRegisterNavBack, useRegisterNavPrimaryAction } from "../../lib/nav-primary-action";

type Pharmacy = { id: string; name: string; address: string | null; phone: string | null };
type Step = "photo" | "details" | "sent";
type Patient = "female" | "male" | "other";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Sends a doctor's slip to a licensed pharmacist (POST /v1/pharmacy/uploads,
 * then /v1/pharmacy/prescriptions). The bottom nav drives it: its right button
 * is the next step and its Home button is a one-step Back.
 */
export function RxSheet({
  open,
  onClose,
  onSent,
  medicine,
  preferredPharmacyId,
  defaultAddress,
}: {
  open: boolean;
  onClose: () => void;
  onSent: (rx: PharmacyPrescription) => void;
  /** A prescription-only product the customer tapped, noted for the pharmacist. */
  medicine?: string | null;
  preferredPharmacyId?: string | null;
  defaultAddress?: string;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [step, setStep] = useState<Step>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[] | null>(null);
  const [pharmaciesError, setPharmaciesError] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState("");
  const [age, setAge] = useState("");
  const [patient, setPatient] = useState<Patient>("female");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPortalReady(true), []);

  // Fresh start each time it opens.
  useEffect(() => {
    if (!open) return;
    setStep("photo");
    setError(null);
    setNotes(medicine ? `For: ${medicine}` : "");
    setAddress(defaultAddress ?? "");
    setPharmaciesError(null);
    api
      .getPharmacies()
      .then(({ pharmacies: list }) => {
        setPharmacies(list);
        setPharmacyId((current) => current || (preferredPharmacyId && list.some((p) => p.id === preferredPharmacyId) ? preferredPharmacyId : list[0]?.id ?? ""));
      })
      .catch((err) => { setPharmacies([]); setPharmaciesError(errorMessage(err)); });
    document.documentElement.classList.add("pharmacy-rx-open");
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", onKey); document.documentElement.classList.remove("pharmacy-rx-open"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) { setError("Please choose a photo (JPEG, PNG or WebP)."); return; }
    setError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function send() {
    if (!file || !pharmacyId) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await compressImage(file);
      if (!ACCEPTED.includes(photo.type)) { setError("That photo format isn't supported. Use a JPEG, PNG or WebP photo."); return; }
      const { key } = await api.uploadPrescriptionPhoto(photo);
      const ageNumber = age.trim() ? Math.max(0, Math.min(120, Math.round(Number(age)))) : undefined;
      const { prescription } = await api.submitPrescription({
        pharmacyId,
        prescriptionImageKey: key,
        patientNotes: notes.trim() || undefined,
        patientAge: Number.isFinite(ageNumber) ? ageNumber : undefined,
        patientGender: patient,
        deliveryAddress: address.trim() || undefined,
      });
      onSent(prescription);
      setFile(null);
      setPreview(null);
      setAge("");
      setStep("sent");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const unavailable = pharmacies !== null && pharmacies.length === 0;

  useRegisterNavBack(open, () => (step === "details" ? setStep("photo") : onClose()), 3);
  useRegisterNavPrimaryAction(
    !open
      ? null
      : step === "photo"
        ? { tone: "step", label: "Next: details", sublabel: file ? "Photo added" : "Add a photo first", disabled: !file, onClick: () => setStep("details") }
        : step === "details"
          ? { tone: "gold", label: busy ? "Sending…" : "Send to pharmacist", disabled: busy || !pharmacyId || unavailable, busy, onClick: () => void send() }
          : { tone: "step", label: "Done", onClick: onClose },
    3,
  );

  if (!portalReady) return null;

  return createPortal(
    <div className={`rx-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button type="button" className="rx-layer-backdrop" aria-label="Close prescription" tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="rx-sheet-title" className="rx-sheet" inert={!open}>
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            {step !== "sent" && (
              <div className="rx-steps mb-2 flex items-center gap-1.5" aria-label={`Step ${step === "photo" ? 1 : 2} of 2`}>
                <span className={`h-1.5 rounded-full ${step === "photo" ? "is-on w-6" : "is-on w-3"}`} />
                <span className={`h-1.5 rounded-full ${step === "details" ? "is-on w-6" : "w-3"}`} />
              </div>
            )}
            <h2 id="rx-sheet-title" className="text-[19px] font-black tracking-tight">
              {step === "photo" ? "Your doctor's slip" : step === "details" ? "Who it's for" : "Sent to the pharmacist"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {step === "photo" ? "A clear photo with the medicine names and signature." : step === "details" ? "A pharmacist prices it before anything is charged." : "You'll see the quote here once it's priced."}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink-500 transition active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4">
          {step === "photo" && (
            <div className="rx-fade-in space-y-3">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={choose} />
              {preview ? (
                <div className="relative overflow-hidden rounded-3xl border border-[var(--border-faint)] bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Your prescription" className="max-h-[38vh] w-full object-contain" />
                  <button type="button" onClick={() => fileInput.current?.click()} className="rx-glass-chip absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                    <RefreshCw className="h-3.5 w-3.5" /> Retake
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()} className="rx-drop flex w-full flex-col items-center justify-center rounded-3xl px-6 py-10 text-center">
                  <span className="rx-hero-icon flex h-14 w-14 items-center justify-center rounded-2xl"><Camera className="h-6 w-6" strokeWidth={2} /></span>
                  <span className="mt-3 text-sm font-bold">Take a photo or choose one</span>
                  <span className="mt-1 text-xs text-ink-500">JPEG, PNG or WebP</span>
                </button>
              )}
              <p className="flex items-center gap-2 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 shrink-0 text-gold" /> Private: only you and the pharmacy you choose can see it.</p>
            </div>
          )}

          {step === "details" && (
            <div className="rx-fade-in space-y-4">
              <fieldset className="min-w-0 space-y-2">
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Pharmacy</legend>
                {pharmacies === null && <div className="h-14 animate-pulse rounded-2xl bg-[rgb(var(--surface-muted))]" />}
                {unavailable && (
                  <p className="flex items-start gap-2 rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs text-ink-500">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    {pharmaciesError ?? "No licensed pharmacy is taking prescriptions right now. Please try again later."}
                  </p>
                )}
                {pharmacies?.map((p) => (
                  <label key={p.id} className={`rx-option flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3 ${p.id === pharmacyId ? "is-selected" : ""}`}>
                    <input type="radio" name="rx-pharmacy" value={p.id} checked={p.id === pharmacyId} onChange={() => setPharmacyId(p.id)} className="h-4 w-4 accent-[rgb(var(--color-gold))]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      {p.address && <span className="block truncate text-xs text-ink-500">{p.address}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="grid grid-cols-[88px_1fr] gap-3">
                <label className="min-w-0 space-y-1.5">
                  <span className="block text-xs font-bold uppercase tracking-wider text-ink-500">Age</span>
                  <span className="rx-field field-box block rounded-2xl"><input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="28" className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm focus:outline-none" /></span>
                </label>
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold uppercase tracking-wider text-ink-500">Patient</span>
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] p-1" role="radiogroup" aria-label="Patient">
                    {(["female", "male", "other"] as const).map((g) => (
                      <button key={g} type="button" role="radio" aria-checked={patient === g} onClick={() => setPatient(g)} className={`rounded-xl py-2 text-xs font-bold capitalize transition ${patient === g ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm" : "text-ink-500"}`}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-ink-500">Deliver to</span>
                <span className="rx-field field-box flex items-center gap-2 rounded-2xl px-3"><MapPin className="h-4 w-4 shrink-0 text-gold" /><input value={address} onChange={(e) => setAddress(e.target.value.slice(0, 200))} placeholder="Area, street or landmark" className="w-full bg-transparent py-2.5 text-sm focus:outline-none" /></span>
              </label>

              <label className="block space-y-1.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-ink-500">Notes for the pharmacist <span className="normal-case tracking-normal font-medium">(optional)</span></span>
                <span className="rx-field field-box block rounded-2xl"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1000))} placeholder="Allergies, or a form you prefer (e.g. syrup)" className="w-full resize-none bg-transparent px-3 py-2.5 text-sm focus:outline-none" /></span>
              </label>
            </div>
          )}

          {step === "sent" && (
            <div className="rx-fade-in flex flex-col items-center px-4 py-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold"><CheckCircle2 className="h-8 w-8" /></span>
              <p className="mt-4 text-base font-bold">A pharmacist is reviewing it</p>
              <p className="mt-1 text-sm text-ink-500">Track it under “Your prescriptions” on the pharmacy page.</p>
            </div>
          )}

          {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
