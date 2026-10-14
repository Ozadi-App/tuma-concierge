"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  HeartPulse,
  PackageCheck,
  Pill,
  Plus,
  ShieldCheck,
  Thermometer,
  TrendingUp,
  Truck,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";

const ugx = (val: number) => `UGX ${val.toLocaleString()}`;

const INITIAL_PRESCRIPTIONS = [
  {
    id: "rx_demo_01",
    patientName: "Prossy Kembabazi",
    patientAge: 32,
    patientGender: "Female",
    timeAgo: "6 mins ago",
    doctorName: "Dr. Mukasa (Norvik Hospital)",
    slipUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=400&q=80",
    symptoms: "Persistent chesty cough, low fever x 3 days. Penicillin allergy noted.",
    status: "pending_review",
  },
  {
    id: "rx_demo_02",
    patientName: "Ronald Mugisha",
    patientAge: 45,
    patientGender: "Male",
    timeAgo: "14 mins ago",
    doctorName: "Dr. Nalule (Case Clinic)",
    slipUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80",
    symptoms: "Monthly refill for hypertension and gastric acid management.",
    status: "pending_review",
  },
  {
    id: "rx_demo_03",
    patientName: "Baby Ethan (Mother: Joy)",
    patientAge: 2,
    patientGender: "Child",
    timeAgo: "22 mins ago",
    doctorName: "Dr. Bbosa (Children's Clinic Kololo)",
    slipUrl: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80",
    symptoms: "Teething pain, mild colic, infant paracetamol drops requested.",
    status: "pending_review",
  },
];

const RECENT_DISPENSED_ORDERS = [
  {
    id: "ord_pharma_881",
    customer: "David Otim",
    items: "Panadol Extra (24s), Redoxon Vit C 1000mg",
    amount: 34500,
    status: "Ready for Pickup",
    time: "10 mins ago",
  },
  {
    id: "ord_pharma_880",
    customer: "Grace Nakato",
    items: "Piriton 4mg, Strepsils Honey & Lemon",
    amount: 17500,
    status: "Rider En Route",
    time: "25 mins ago",
  },
  {
    id: "ord_pharma_879",
    customer: "Arthur Ssemwanga",
    items: "Savlon Antiseptic 250ml, Bandages",
    amount: 21500,
    status: "Delivered",
    time: "48 mins ago",
  },
];

export default function PharmacyDashboardPage() {
  const { pharmacy, pharmacist } = useAuth();
  const [prescriptions] = useState(INITIAL_PRESCRIPTIONS);

  return (
    <div className="space-y-5">
      {/* Supervising Pharmacist Banner */}
      <section className="flex items-center justify-between rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/15 via-[rgb(var(--surface-card))] to-gold/5 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold text-ink-gold shadow-md">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gold">
              <ShieldCheck className="h-3 w-3" />
              <span>Supervising Pharmacist</span>
            </div>
            <h2 className="text-sm font-black text-ink">{pharmacist?.name}</h2>
            <p className="text-[11px] text-ink-500 font-medium">
              Licence: {pharmacist?.aplNumber} · Valid 2026
            </p>
          </div>
        </div>

        <Link
          href="/license"
          className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-xs font-bold text-ink-500 hover:text-ink"
        >
          NDA File →
        </Link>
      </section>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/prescriptions"
          className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm transition hover:border-gold/50 active:scale-98"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <FileText className="h-4 w-4" />
            </span>
            <span className="flex h-2 w-2 rounded-full bg-gold animate-pulse" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-ink">{prescriptions.length}</p>
            <p className="text-xs font-bold text-ink-500">Rx Review Queue</p>
          </div>
          <span className="mt-2 block text-[10px] font-black text-gold">
            Review prescriptions →
          </span>
        </Link>

        <div className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600/15 text-green-600">
              <TrendingUp className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-green-600">+18% today</span>
          </div>
          <div className="mt-3">
            <p className="text-xl font-black text-ink">{ugx(485000)}</p>
            <p className="text-xs font-bold text-ink-500">Today's Sales</p>
          </div>
          <span className="mt-2 block text-[10px] font-bold text-ink-500">
            14 dispensed orders
          </span>
        </div>

        <Link
          href="/inventory"
          className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm transition hover:border-gold/50 active:scale-98"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Pill className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-gold">148 in stock</span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-ink">45</p>
            <p className="text-xs font-bold text-ink-500">Rx Medicines</p>
          </div>
          <span className="mt-2 block text-[10px] font-black text-gold">
            Manage catalogue →
          </span>
        </Link>

        <Link
          href="/license"
          className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm transition hover:border-gold/50 active:scale-98"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <Thermometer className="h-4 w-4" />
            </span>
            <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[9px] font-black text-green-600">
              Normal
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-ink">4.2°C</p>
            <p className="text-xs font-bold text-ink-500">Fridge Storage</p>
          </div>
          <span className="mt-2 block text-[10px] font-bold text-ink-500">
            Target 2°C – 8°C cold chain
          </span>
        </Link>
      </section>

      {/* Prescription Triage Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-ink">Incoming Doctor Prescriptions</h2>
            <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-ink-gold">
              {prescriptions.length} Pending
            </span>
          </div>
          <Link href="/prescriptions" className="text-xs font-black text-gold hover:underline">
            View All →
          </Link>
        </div>

        <div className="space-y-2.5">
          {prescriptions.map((rx) => (
            <article
              key={rx.id}
              className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-black/5">
                    <img
                      src={rx.slipUrl}
                      alt="Prescription slip"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-ink">{rx.patientName}</h3>
                    <p className="text-[11px] text-ink-500 font-medium">
                      {rx.patientAge} yrs · {rx.patientGender} · {rx.timeAgo}
                    </p>
                    <p className="text-[10px] font-bold text-gold">{rx.doctorName}</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
                  <Clock className="h-3 w-3" /> Waiting
                </span>
              </div>

              <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-2.5 text-xs text-ink-500 leading-relaxed">
                <span className="font-bold text-ink">Patient Note: </span>
                {rx.symptoms}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-ink-500">
                  NDA Doctor verification required
                </span>
                <Link
                  href={`/prescriptions?id=${rx.id}`}
                  className="flex items-center gap-1 rounded-xl bg-gold px-3 py-1.5 text-xs font-black text-ink-gold shadow-sm hover:opacity-90 active:scale-95"
                >
                  <span>Review & Dispense</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Recent Dispensed & Dispatched Orders */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-ink">Recent Dispensed Orders</h2>
          <span className="text-xs text-ink-500">Live courier tracking</span>
        </div>

        <div className="space-y-2">
          {RECENT_DISPENSED_ORDERS.map((ord) => (
            <div
              key={ord.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm"
            >
              <div className="space-y-0.5 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-black text-ink">{ord.customer}</p>
                  <span className="text-[10px] font-bold text-ink-500">#{ord.id.slice(-4)}</span>
                </div>
                <p className="truncate text-[11px] text-ink-500">{ord.items}</p>
                <p className="text-[10px] font-semibold text-ink-500">{ord.time}</p>
              </div>

              <div className="text-right shrink-0 space-y-1">
                <span className="font-mono text-xs font-black text-ink">
                  {ugx(ord.amount)}
                </span>
                <span className="block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                  {ord.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
