"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Info,
  Maximize2,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

const ugx = (val: number) => `UGX ${Math.round(val).toLocaleString()}`;

interface PrescribedItemDraft {
  id: string;
  name: string;
  strength: string;
  dosage: string;
  quantity: number;
  unitPrice: number;
}

interface PrescriptionCase {
  id: string;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: string;
  deliveryAddress: string;
  doctorName: string;
  clinicHospital: string;
  slipUrl: string;
  patientNotes: string;
  receivedAt: string;
  status: "pending_review" | "priced_ready" | "dispensed" | "declined";
  pharmacistAdvice?: string;
  items: PrescribedItemDraft[];
}

const SAMPLE_CASES: PrescriptionCase[] = [
  {
    id: "rx_demo_01",
    patientName: "Prossy Kembabazi",
    patientPhone: "+256 772 344 556",
    patientAge: 32,
    patientGender: "Female",
    deliveryAddress: "Kisementi, Plot 14 Acacia Avenue",
    doctorName: "Dr. Mukasa David",
    clinicHospital: "Norvik Hospital, Kampala",
    slipUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=600&q=80",
    patientNotes: "Chesty cough x 3 days, low fever, throat irritation. Allergic to Amoxicillin/Penicillin.",
    receivedAt: "6 mins ago",
    status: "pending_review",
    pharmacistAdvice: "Take after meals. Complete full 5-day course. Drink plenty of warm liquids.",
    items: [
      {
        id: "item_1",
        name: "Ascoril Expectorant Cough Syrup",
        strength: "100ml",
        dosage: "10ml three times daily after meals",
        quantity: 1,
        unitPrice: 16000,
      },
      {
        id: "item_2",
        name: "Panadol Extra Tablets",
        strength: "500mg/65mg",
        dosage: "2 tablets every 8 hours as needed for fever",
        quantity: 1,
        unitPrice: 6500,
      },
      {
        id: "item_3",
        name: "Strepsils Honey & Lemon Lozenges",
        strength: "16s",
        dosage: "Dissolve 1 lozenge in mouth every 3 hours",
        quantity: 1,
        unitPrice: 12500,
      },
    ],
  },
  {
    id: "rx_demo_02",
    patientName: "Ronald Mugisha",
    patientPhone: "+256 754 112 334",
    patientAge: 45,
    patientGender: "Male",
    deliveryAddress: "Bugolobi Flats, Block 4C",
    doctorName: "Dr. Nalule Sarah",
    clinicHospital: "Case Medical Centre",
    slipUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80",
    patientNotes: "Regular refill for acid reflux and daily multivitamin.",
    receivedAt: "14 mins ago",
    status: "pending_review",
    pharmacistAdvice: "Take Omeprazole 30 mins before breakfast.",
    items: [
      {
        id: "item_21",
        name: "Omeprazole Gastro-Resistant Capsules",
        strength: "20mg",
        dosage: "1 capsule once daily before breakfast",
        quantity: 2,
        unitPrice: 10000,
      },
      {
        id: "item_22",
        name: "Redoxon Vit C 1000mg + Zinc",
        strength: "15 Tabs",
        dosage: "1 tablet dissolved in water daily",
        quantity: 1,
        unitPrice: 28000,
      },
    ],
  },
];

export default function PrescriptionsWorkbenchPage() {
  const { pharmacist } = useAuth();
  const [cases, setCases] = useState<PrescriptionCase[]>(SAMPLE_CASES);
  const [activeCaseId, setActiveCaseId] = useState<string>(SAMPLE_CASES[0].id);
  const [tabFilter, setTabFilter] = useState<"all" | "pending" | "approved" | "completed">("pending");
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  const handleApproveQuote = () => {
    if (!activeCase) return;
    setCases((prev) =>
      prev.map((c) =>
        c.id === activeCase.id
          ? { ...c, status: "priced_ready" }
          : c
      )
    );
    setNotice("Prescription verified and quoted! Quote sent to patient for checkout.");
    setTimeout(() => setNotice(null), 3000);
  };

  const handleDecline = (reason: string) => {
    if (!activeCase) return;
    setCases((prev) =>
      prev.map((c) =>
        c.id === activeCase.id
          ? { ...c, status: "declined" }
          : c
      )
    );
    setNotice(`Prescription declined: ${reason}`);
    setTimeout(() => setNotice(null), 3000);
  };

  const subtotal = activeCase.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Workbench Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-ink">Prescription Triage Console</h1>
          <p className="text-xs text-ink-500 font-medium">
            NDA Pharmacist verification and dosage review workstation
          </p>
        </div>

        <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-black text-gold">
          {cases.filter((c) => c.status === "pending_review").length} Awaiting Review
        </span>
      </div>

      {notice && (
        <div className="rounded-2xl bg-gold/15 p-3 text-xs font-bold text-ink flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Case Selector Chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {cases.map((c) => {
          const isSelected = c.id === activeCase.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCaseId(c.id)}
              className={`flex items-center gap-2 shrink-0 rounded-2xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
                isSelected
                  ? "border border-gold bg-gold/10 text-ink shadow-sm font-black"
                  : "border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] text-ink-500"
              }`}
            >
              <FileText className={`h-3.5 w-3.5 ${isSelected ? "text-gold" : "text-ink-500"}`} />
              <span>{c.patientName}</span>
              <span className="text-[10px] text-ink-500">({c.receivedAt})</span>
            </button>
          );
        })}
      </div>

      {/* Main Review Card */}
      <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm space-y-4">
        {/* Patient Details & Doctor Attribution */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-faint)]">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-gold">
              Patient Case #{activeCase.id.slice(-4).toUpperCase()}
            </span>
            <h2 className="text-base font-black text-ink mt-0.5">{activeCase.patientName}</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {activeCase.patientAge} years · {activeCase.patientGender} · {activeCase.patientPhone}
            </p>
            <p className="text-[11px] text-ink-500 mt-0.5 font-medium">
              Deliver to: {activeCase.deliveryAddress}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-black text-gold">
              <Clock className="h-3 w-3" /> {activeCase.receivedAt}
            </span>
            <p className="text-xs font-bold text-ink mt-1.5">{activeCase.doctorName}</p>
            <p className="text-[10px] text-ink-500">{activeCase.clinicHospital}</p>
          </div>
        </div>

        {/* Doctor Prescription Slip Viewer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-gold" />
              Doctor Slip Uploaded by Patient
            </span>
            <button
              type="button"
              onClick={() => setShowImageZoom(true)}
              className="text-[11px] font-bold text-gold flex items-center gap-1 hover:underline"
            >
              <Maximize2 className="h-3 w-3" /> Full Screen
            </button>
          </div>

          <div
            onClick={() => setShowImageZoom(true)}
            className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-black/5 cursor-pointer"
          >
            <img
              src={activeCase.slipUrl}
              alt="Prescription slip"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition">
              <span className="rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                Click to Zoom & Inspect Slip
              </span>
            </div>
          </div>
        </div>

        {/* Patient Symptoms & Notes */}
        <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs space-y-1">
          <span className="font-bold text-ink flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-gold" /> Patient Symptoms & Allergies
          </span>
          <p className="text-ink-500 leading-relaxed">{activeCase.patientNotes}</p>
        </div>

        {/* Prescribed Medicines Matching Table */}
        <div className="space-y-2 pt-2 border-t border-[var(--border-faint)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-ink uppercase tracking-wider">
              Matched Dispensing Medicines ({activeCase.items.length})
            </h3>
            <span className="text-xs font-bold text-ink-500">Kampala Stock Ready</span>
          </div>

          <div className="space-y-2">
            {activeCase.items.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-ink">
                      {idx + 1}. {item.name}
                    </h4>
                    <p className="text-[11px] text-gold font-bold">{item.strength}</p>
                  </div>
                  <span className="font-mono text-xs font-black text-ink">
                    {ugx(item.unitPrice * item.quantity)}
                  </span>
                </div>

                <div className="rounded-xl bg-[rgb(var(--surface-muted))] px-2.5 py-1.5 text-[11px] text-ink-500">
                  <span className="font-bold text-ink">Dosage Regimen: </span>
                  {item.dosage}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-gold/10 p-3 pt-2">
            <div>
              <span className="text-xs font-bold text-ink-500">Total Prescription Quote</span>
              <p className="text-[10px] text-ink-500">Includes packaging & pharmacist dispensing fee</p>
            </div>
            <span className="font-mono text-base font-black text-ink">{ugx(subtotal)}</span>
          </div>
        </div>

        {/* Pharmacist Clinical Advice */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink-500">
            Pharmacist Instructions to Patient
          </label>
          <div className="field-box rounded-2xl border border-[var(--border-faint)]">
            <textarea
              rows={2}
              value={activeCase.pharmacistAdvice || ""}
              onChange={(e) => {
                const val = e.target.value;
                setCases((prev) =>
                  prev.map((c) =>
                    c.id === activeCase.id ? { ...c, pharmacistAdvice: val } : c
                  )
                );
              }}
              placeholder="e.g. Take after food. Complete all 5 days. Drink lots of water..."
              className="w-full bg-transparent p-3 text-xs text-ink focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Pharmacist Action Bar */}
        <div className="pt-2 border-t border-[var(--border-faint)] space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApproveQuote}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95 active:scale-98"
            >
              <FileCheck className="h-4 w-4" />
              Sign & Send Quote ({ugx(subtotal)})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDecline("Doctor slip illegible, clearer image requested")}
              className="flex-1 rounded-2xl border border-[var(--border-faint)] py-2 text-[11px] font-bold text-ink-500 hover:text-ink active:scale-98"
            >
              Request Clearer Slip
            </button>
            <button
              type="button"
              onClick={() => handleDecline("Controlled substance requiring physical hardcopy")}
              className="flex-1 rounded-2xl border border-red-500/30 text-red-500 py-2 text-[11px] font-bold hover:bg-red-500/5 active:scale-98"
            >
              Decline (Controlled Drug)
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {showImageZoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="relative max-h-[90vh] max-w-2xl w-full">
            <button
              type="button"
              onClick={() => setShowImageZoom(false)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={activeCase.slipUrl}
              alt="Prescription slip zoomed"
              className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
