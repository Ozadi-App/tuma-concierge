"use client";

import { PRACTICE_JOURNEYS } from "@peebee/shared";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Copy,
  Fuel,
  Info,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const JOURNEY = PRACTICE_JOURNEYS.gas;

const SAMPLE_CUSTOMERS = {
  rider: {
    type: "motorcycle",
    code: "429-081",
    name: "Okello Ronald",
    phone: "0772 *** 819",
    plate: "UFE 429K",
    vehicleModel: "Bajaj Boxer 150 (Motorcycle)",
    maxLimitUgx: 50_000,
    balanceUgx: 35_000,
    stage: "Clock Tower Boda Stage",
    defaultAmount: 20_000,
  },
  driver: {
    type: "car",
    code: "902-114",
    name: "Daniel Kato",
    phone: "0784 *** 220",
    plate: "UBK 902F",
    vehicleModel: "Toyota Corolla 2021 (Saloon Car)",
    maxLimitUgx: 150_000,
    balanceUgx: 120_000,
    stage: "Peebee Car Fleet · Kampala",
    defaultAmount: 50_000,
  },
};

export default function GasPracticePage() {
  const [customerType, setCustomerType] = useState<"rider" | "driver">("rider");
  const activeCustomer = SAMPLE_CUSTOMERS[customerType];
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [enteredCode, setEnteredCode] = useState(activeCustomer.code);
  const [selectedProduct, setSelectedProduct] = useState<"petrol" | "diesel">("petrol");
  const [ugxAmount, setUgxAmount] = useState(activeCustomer.defaultAmount);
  const [isDispensing, setIsDispensing] = useState(false);
  const [dispenseProgress, setDispenseProgress] = useState(0);
  const [dispenseDone, setDispenseDone] = useState(false);

  function switchCustomerType(type: "rider" | "driver") {
    setCustomerType(type);
    const target = SAMPLE_CUSTOMERS[type];
    setEnteredCode(target.code);
    setUgxAmount(target.defaultAmount);
  }

  const pricePerLitre = selectedProduct === "petrol" ? 5_450 : 5_200;
  const litres = Math.round((ugxAmount / pricePerLitre) * 100) / 100;

  function simulateDispense() {
    setIsDispensing(true);
    setDispenseProgress(0);
    const interval = setInterval(() => {
      setDispenseProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDispensing(false);
          setDispenseDone(true);
          return 100;
        }
        return prev + 25;
      });
    }, 300);
  }

  function resetPractice() {
    setCurrentStepIndex(0);
    setCustomerType("rider");
    setEnteredCode(SAMPLE_CUSTOMERS.rider.code);
    setSelectedProduct("petrol");
    setUgxAmount(SAMPLE_CUSTOMERS.rider.defaultAmount);
    setIsDispensing(false);
    setDispenseProgress(0);
    setDispenseDone(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink transition hover:border-gold"
            aria-label="Back to Pump"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-black uppercase text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                Practice Mode
              </span>
              <span className="text-xs text-ink-500">Step {currentStepIndex + 1} of 4</span>
            </div>
            <h1 className="text-lg font-black text-ink">{JOURNEY.heading}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={resetPractice}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] text-ink hover:bg-[rgb(var(--surface-muted))]"
          title="Restart practice"
          aria-label="Restart practice"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </header>

      {/* Safety Banner */}
      <aside className="rounded-2xl border border-sky-300 bg-sky-50/70 p-3.5 text-xs text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="space-y-1">
            <p className="font-bold">Completely safe training simulator</p>
            <p className="leading-relaxed opacity-90">{JOURNEY.introduction}</p>
          </div>
        </div>
      </aside>

      {/* Step Progress Pills */}
      <div className="grid grid-cols-4 gap-1.5">
        {JOURNEY.steps.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;
          return (
            <button
              key={step.title}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                isCurrent
                  ? "bg-gold"
                  : isPassed
                  ? "bg-green"
                  : "bg-[var(--border-faint)]"
              }`}
              title={step.title}
              aria-label={`Go to step ${idx + 1}: ${step.title}`}
            />
          );
        })}
      </div>

      {/* Step Card */}
      <section className="home-card space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold">
            Step {currentStepIndex + 1}: {JOURNEY.steps[currentStepIndex].title}
          </span>
          <p className="mt-1 text-xs text-ink-500">
            {JOURNEY.steps[currentStepIndex].description}
          </p>
        </div>

        {/* STEP 1: VERIFY CODE */}
        {currentStepIndex === 0 && (
          <div className="space-y-4">
            {/* Customer Switcher */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-500">
                Choose Practice Customer Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchCustomerType("rider")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${
                    customerType === "rider"
                      ? "border-gold bg-gold/15 text-ink font-black"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500"
                  }`}
                >
                  <Bike className="h-4 w-4 text-gold" />
                  <span>Motorcycle Rider</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchCustomerType("driver")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${
                    customerType === "driver"
                      ? "border-navy bg-navy/15 text-ink font-black"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500"
                  }`}
                >
                  <CarFront className="h-4 w-4 text-navy" />
                  <span>Car Driver</span>
                </button>
              </div>
            </div>

            <div className="field-box flex items-center gap-3 p-3">
              <QrCode className="h-6 w-6 text-gold" />
              <div className="min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase text-ink-500">
                  {customerType === "driver" ? "Car Driver PIN" : "Rider 6-Digit PIN"}
                </label>
                <input
                  type="text"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value)}
                  className="w-full font-mono text-base font-black tracking-widest text-ink outline-none"
                  placeholder="e.g. 429-081"
                />
              </div>
            </div>

            {/* Customer Identity Verification Preview */}
            <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                    {customerType === "rider" ? (
                      <Bike className="h-5 w-5" />
                    ) : (
                      <CarFront className="h-5 w-5 text-navy" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-ink">{activeCustomer.name}</h3>
                    <p className="font-mono text-xs font-bold text-gold">{activeCustomer.plate}</p>
                  </div>
                </div>
                <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-[11px] font-bold text-green">
                  Verified Active
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-faint)] pt-2.5 text-ink-500">
                <div>
                  <span className="block text-[10px] uppercase">Vehicle</span>
                  <strong className="text-ink">{activeCustomer.vehicleModel}</strong>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Daily Allowance</span>
                  <strong className="text-ink">UGX {activeCustomer.maxLimitUgx.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStepIndex(1)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-sm hover:opacity-95"
            >
              <span>{JOURNEY.steps[0].actionLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: SELECT PRODUCT & AMOUNT */}
        {currentStepIndex === 1 && (
          <div className="space-y-4">
            {/* Fuel selection tabs */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-500">
                Select Fuel Nozzle
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct("petrol")}
                  className={`flex flex-col items-center justify-center rounded-2xl border p-3 transition ${
                    selectedProduct === "petrol"
                      ? "border-gold bg-gold/10 text-ink font-black"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500 font-bold"
                  }`}
                >
                  <Fuel className="h-5 w-5 text-gold" />
                  <span className="mt-1 text-xs">Unleaded Petrol</span>
                  <span className="text-[11px] font-bold text-gold">UGX 5,450 / L</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProduct("diesel")}
                  className={`flex flex-col items-center justify-center rounded-2xl border p-3 transition ${
                    selectedProduct === "diesel"
                      ? "border-navy bg-navy/10 text-ink font-black"
                      : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink-500 font-bold"
                  }`}
                >
                  <Fuel className="h-5 w-5 text-navy" />
                  <span className="mt-1 text-xs">Automotive Diesel</span>
                  <span className="text-[11px] font-bold text-navy">UGX 5,200 / L</span>
                </button>
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-500">
                Preset UGX Amounts
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[10_000, 20_000, 30_000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setUgxAmount(amt)}
                    className={`rounded-xl border py-2 text-xs font-bold transition ${
                      ugxAmount === amt
                        ? "border-gold bg-gold text-ink-gold"
                        : "border-[var(--border-faint)] bg-[rgb(var(--surface-input))] text-ink"
                    }`}
                  >
                    UGX {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Computation Display */}
            <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 text-center">
              <span className="text-xs uppercase text-ink-500">Calculated Dispense Volume</span>
              <div className="mt-1 text-2xl font-black text-ink">
                {litres} <span className="text-base font-bold text-ink-500">Litres</span>
              </div>
              <p className="mt-1 text-xs font-bold text-gold">
                Total: UGX {ugxAmount.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentStepIndex(0)}
                className="flex min-h-12 w-28 items-center justify-center rounded-2xl border border-[var(--border-faint)] font-bold text-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStepIndex(2)}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-sm"
              >
                <span>{JOURNEY.steps[1].actionLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DISPENSE FUEL & ISSUE RECEIPT */}
        {currentStepIndex === 2 && (
          <div className="space-y-4">
            {!dispenseDone ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Fuel className={`h-8 w-8 ${isDispensing ? "animate-bounce" : ""}`} />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">
                    {isDispensing ? "Pumping Fuel..." : "Ready to Dispense"}
                  </h3>
                  <p className="text-xs text-ink-500">
                    Verify plate <strong className="text-ink">{activeCustomer.plate}</strong> matches
                    the vehicle at your pump lane ({activeCustomer.vehicleModel}).
                  </p>
                </div>

                {isDispensing && (
                  <div className="space-y-2">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                      <div
                        className="h-full bg-green transition-all duration-300"
                        style={{ width: `${dispenseProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-ink">
                      {Math.round((litres * dispenseProgress) / 100 * 100) / 100} / {litres} Litres
                    </span>
                  </div>
                )}

                {!isDispensing && (
                  <button
                    type="button"
                    onClick={simulateDispense}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-green font-bold text-white shadow-sm hover:opacity-95"
                  >
                    <span>{JOURNEY.steps[2].actionLabel}</span>
                  </button>
                )}
              </div>
            ) : (
              /* Digital Receipt Simulation */
              <div className="space-y-4">
                <div className="rounded-2xl border border-green/30 bg-green/10 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-green" />
                  <h3 className="mt-1 text-sm font-black text-green">Dispense Completed</h3>
                  <p className="text-xs text-ink-500">Simulated Digital Receipt Generated</p>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 font-mono text-xs">
                  <div className="flex justify-between border-b border-[var(--border-faint)] pb-2">
                    <span className="font-bold text-ink">Receipt #</span>
                    <span className="text-gold font-bold">RCP-GAS-88412</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Customer:</span>
                    <span className="font-bold text-ink">{activeCustomer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Vehicle:</span>
                    <span className="font-bold text-ink">{activeCustomer.plate} ({activeCustomer.type === "car" ? "Car" : "Boda"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Fuel:</span>
                    <span className="font-bold text-ink">
                      {selectedProduct === "petrol" ? "Unleaded Petrol" : "Automotive Diesel"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Volume:</span>
                    <span className="font-bold text-ink">{litres} L</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--border-faint)] pt-2 text-sm font-black">
                    <span>Total Settled:</span>
                    <span className="text-green">UGX {ugxAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStepIndex(3)}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-sm"
                >
                  <span>{JOURNEY.steps[2].resultLabel} → Next</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: SHIFT REPORT */}
        {currentStepIndex === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold" />
                <h3 className="text-sm font-black text-ink">Daily Pump Shift Summary</h3>
              </div>
              <p className="text-xs text-ink-500">
                Notice how the practice transaction is simulated and accounted for in your shift tally.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] p-3">
                  <span className="text-[10px] uppercase text-ink-500">Total Fuel Dispensed</span>
                  <div className="mt-1 text-base font-black text-ink">{litres} Litres</div>
                  <span className="text-[10px] text-green font-bold">+1 Practice sale</span>
                </div>
                <div className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] p-3">
                  <span className="text-[10px] uppercase text-ink-500">Shift Total Settled</span>
                  <div className="mt-1 text-base font-black text-gold">
                    UGX {ugxAmount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-ink-500">0 cash discrepancies</span>
                </div>
              </div>
            </div>

            {/* Completion Banner */}
            <div className="rounded-2xl border border-green/30 bg-green/10 p-4 text-center space-y-2">
              <ShieldCheck className="mx-auto h-7 w-7 text-green" />
              <h3 className="text-sm font-black text-ink">Practice Session Complete!</h3>
              <p className="text-xs text-ink-500">{JOURNEY.completionMessage}</p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={resetPractice}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface))] font-bold text-ink hover:bg-[rgb(var(--surface-muted))]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Practise Again</span>
              </button>

              <Link
                href="/"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-ink-gold shadow-sm"
              >
                <span>Return to Live Pump Screen</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
