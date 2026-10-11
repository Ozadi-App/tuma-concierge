"use client";

import { ArrowLeft, CheckCircle2, Fuel, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ApplyStationPage() {
  const [stationName, setStationName] = useState("");
  const [brand, setBrand] = useState("TotalEnergies");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [pumpsCount, setPumpsCount] = useState("4");
  const [submitted, setSubmitted] = useState(false);
  const [appId, setAppId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAppId(`GAS-APP-${Math.floor(10000 + Math.random() * 90000)}`);
    setSubmitted(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-faint)] text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-black text-ink">Onboard Petrol Station</h1>
      </div>

      {submitted ? (
        <section className="home-card space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green" />
          <h2 className="text-xl font-black text-ink">Station Registration Received</h2>
          <p className="text-xs text-ink-500">
            Thank you, {contactName}. Your application for <strong>{stationName}</strong> has been logged for Peebee merchant verification.
          </p>
          <div className="rounded-xl bg-gold/10 p-3 font-mono text-sm font-black text-ink">
            Reference: {appId}
          </div>
          <Link
            href="/"
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-gold font-bold text-ink-gold"
          >
            Go to Attendant Workspace →
          </Link>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="home-card space-y-3.5">
          <div>
            <label className="text-xs font-bold text-ink-500">Petrol Station Brand</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
            >
              <option value="TotalEnergies">TotalEnergies</option>
              <option value="Shell">Shell (Vivo Energy)</option>
              <option value="Rubis">Rubis Energy</option>
              <option value="Stabex">Stabex International</option>
              <option value="Hass">Hass Petroleum</option>
              <option value="CityOil">CityOil</option>
              <option value="Oryx">Oryx Energies</option>
              <option value="Independent">Independent Dealer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-ink-500">Station Branch / Outlet Name</label>
            <input
              required
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="e.g. TotalEnergies Busega Roundabout"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink-500">Physical Address / Road / Area</label>
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Masaka Road, Busega, Kampala"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-ink-500">Station Manager Name</label>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Manager Name"
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink-500">Active Pump Lanes</label>
              <input
                type="number"
                min="1"
                max="24"
                value={pumpsCount}
                onChange={(e) => setPumpsCount(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-ink-500">Station Contact Phone (MoMo)</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+256 700 000 000"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-faint)] px-3 text-sm text-ink outline-none"
            />
          </div>

          <button
            type="submit"
            className="mt-2 min-h-12 w-full rounded-2xl bg-gold font-bold text-ink-gold shadow hover:opacity-95"
          >
            Submit Station Application
          </button>
        </form>
      )}
    </div>
  );
}
