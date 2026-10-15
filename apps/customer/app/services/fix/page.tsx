"use client";

import { useRegisterNavPrimaryAction } from "../../../lib/nav-primary-action";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Hammer,
  Lightbulb,
  MapPin,
  PenTool,
  ShieldCheck,
  Tv,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface FixCategory {
  id: string;
  name: string;
  icon: typeof Wrench;
  examples: string;
  startingFeeUgx: number;
}

const FIX_CATEGORIES: FixCategory[] = [
  { id: "plumbing", name: "Plumbing", icon: Wrench, examples: "Leaking pipe, tap replacement, clogged sink, toilet fixture", startingFeeUgx: 20000 },
  { id: "electrical", name: "Electrical", icon: Zap, examples: "Socket fault, circuit breaker, lighting fixtures, short circuit", startingFeeUgx: 25000 },
  { id: "appliances", name: "Appliances", icon: Tv, examples: "Fridge cooling, washing machine drum, microwave, stove burner", startingFeeUgx: 30000 },
  { id: "carpentry", name: "Carpentry & Locks", icon: Hammer, examples: "Door lock repair, hinges, wardrobe assembly, chair fixing", startingFeeUgx: 20000 },
  { id: "painting", name: "Painting & Drywall", icon: PenTool, examples: "Water stain touch-up, wall cracks, door repaint", startingFeeUgx: 35000 },
];

export default function FixPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("plumbing");
  const [urgency, setUrgency] = useState<"standard" | "urgent" | "emergency">("standard");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [locationAddress, setLocationAddress] = useState("Ntinda Complex, Kampala");
  const [photoCount, setPhotoCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const currentCategory = FIX_CATEGORIES.find((cat) => cat.id === selectedCategory) ?? FIX_CATEGORIES[0];
  const diagnosticFeeUgx = 15000;
  const urgencyFeeUgx = urgency === "emergency" ? 20000 : urgency === "urgent" ? 10000 : 0;
  const totalCalloutFeeUgx = diagnosticFeeUgx + urgencyFeeUgx;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderConfirmed(true);
    }, 900);
  };

  // Requesting the specialist is the bottom nav's gold right capsule.
  useRegisterNavPrimaryAction(orderConfirmed ? null : {
    tone: "gold",
    label: isSubmitting ? "Dispatching Pro…" : "Request Fix Specialist",
    detail: `UGX ${totalCalloutFeeUgx.toLocaleString("en-UG")}`,
    disabled: !issueTitle.trim() || isSubmitting,
    busy: isSubmitting,
    onClick: () => (document.getElementById("fix-request-form") as HTMLFormElement | null)?.requestSubmit(),
  });

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] pb-6 pt-4 px-4 max-w-lg mx-auto text-ink">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.push("/services")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink transition-transform active:scale-95"
          aria-label="Back to Services"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold">Skilled Handyman</span>
          <h1 className="text-lg font-bold">Fix & Repairs</h1>
        </div>
        <div className="h-10 w-10" />
      </div>

      {orderConfirmed ? (
        <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 text-center space-y-4 animate-in fade-in duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Technician Dispatched!</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            A vetted <span className="font-semibold text-ink">{currentCategory.name}</span> pro has received your request.
            {urgency === "emergency" ? " They are en route within 45 minutes." : " They will contact you shortly to confirm arrival."}
          </p>
          <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-left space-y-2">
            <div className="flex justify-between text-xs text-ink-500">
              <span>Issue</span>
              <span className="font-bold text-ink">{issueTitle}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>Diagnosis & Callout</span>
              <span className="font-bold text-gold">UGX {totalCalloutFeeUgx.toLocaleString("en-UG")}</span>
            </div>
            <div className="text-[11px] text-ink-500 pt-1 border-t border-[var(--border-faint)]">
              Diagnosis fee will be deducted from total parts & labor once agreed.
            </div>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/orders"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
            >
              Track Request
            </Link>
            <button
              type="button"
              onClick={() => {
                setOrderConfirmed(false);
                setIssueTitle("");
                setIssueDescription("");
              }}
              className="text-xs font-semibold text-ink-500 underline py-2"
            >
              Request Another Repair
            </button>
          </div>
        </div>
      ) : (
        <form id="fix-request-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Hero Banner */}
          <div className="home-card rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink-gold">
                <Wrench className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-ink">Certified Home Repairs</h2>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Vetted Pros</span>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  Upfront diagnosis pricing, background-checked handymen, and a 14-day warranty on all completed fixes.
                </p>
              </div>
            </div>
          </div>

          {/* Category Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ink block">Select Trade Category</label>
            <div className="grid grid-cols-2 gap-2.5">
              {FIX_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`home-card flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      active
                        ? "border-gold bg-gold/10 shadow-sm"
                        : "border-[var(--border-faint)] bg-[rgb(var(--surface-card))]"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-2 ${
                      active ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-gold"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-bold text-ink">{cat.name}</span>
                    <span className="text-[11px] text-ink-500 mt-0.5 line-clamp-1">{cat.examples}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Urgency Selector */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold" />
              <label className="text-xs font-bold uppercase tracking-wider text-ink">Dispatch Speed</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "standard", label: "Scheduled", sub: "Today / Tomorrow" },
                { id: "urgent", label: "Urgent", sub: "Within 2h (+10k)" },
                { id: "emergency", label: "Emergency", sub: "Immediate (+20k)" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setUrgency(tier.id as typeof urgency)}
                  className={`rounded-xl border p-2.5 text-center transition-all ${
                    urgency === tier.id
                      ? "border-gold bg-gold/15 text-gold font-bold"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink-500"
                  }`}
                >
                  <div className="text-xs font-bold">{tier.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">{tier.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Issue Details */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-ink block">Describe What Needs Fixing</label>
            <div className="field-box flex items-center rounded-xl px-3 py-2.5">
              <input
                type="text"
                required
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder="Brief title (e.g. Kitchen tap won't stop leaking)"
                className="w-full text-sm font-medium outline-none bg-transparent"
              />
            </div>

            <div className="field-box flex items-center rounded-xl px-3 py-2.5">
              <textarea
                rows={3}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="More details (brand, noise, where the water is leaking from...)"
                className="w-full text-xs font-medium outline-none bg-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPhotoCount((prev) => (prev < 4 ? prev + 1 : prev))}
                className="rounded-xl border border-dashed border-gold/40 bg-gold/5 px-3 py-2 text-xs font-bold text-gold flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <span>+ Attach Photo / Video</span>
                {photoCount > 0 && <span className="rounded-full bg-gold px-1.5 py-0.2 text-[10px] text-ink-gold font-black">{photoCount}</span>}
              </button>
              {photoCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPhotoCount(0)}
                  className="text-[11px] text-ink-500 underline"
                >
                  Clear photos
                </button>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gold" />
              <label className="text-xs font-bold uppercase tracking-wider text-ink">Service Address</label>
            </div>
            <div className="field-box flex items-center rounded-xl px-3 py-2.5">
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Enter physical address / landmark"
                className="w-full text-sm font-medium outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Pricing & Submit */}
          <div className="home-card rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>Diagnostic & Callout Fee</span>
              <span className="font-semibold text-ink">UGX {diagnosticFeeUgx.toLocaleString("en-UG")}</span>
            </div>
            {urgencyFeeUgx > 0 && (
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>Speed Surcharge ({urgency})</span>
                <span className="font-semibold text-ink">UGX {urgencyFeeUgx.toLocaleString("en-UG")}</span>
              </div>
            )}
            <div className="border-t border-[var(--border-faint)] pt-2.5 flex items-center justify-between">
              <span className="text-sm font-bold text-ink">Initial Callout Due</span>
              <span className="text-base font-extrabold text-gold">UGX {totalCalloutFeeUgx.toLocaleString("en-UG")}</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              <span>14-day warranty on all completed labor & fittings</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
