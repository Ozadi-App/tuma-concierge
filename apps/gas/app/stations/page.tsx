"use client";

import type { FuelStationOutlet } from "@peebee/shared";
import { Building2, Check, Fuel, MapPin, Phone, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

export default function StationsDirectoryPage() {
  const { outlets, outlet, selectOutlet } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const ugx = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  const brands = Array.from(new Set(outlets.map((o) => o.station_name)));

  const filtered = outlets.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.address?.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase());

    const matchesBrand = !selectedBrand || item.station_name === selectedBrand;
    return matchesSearch && matchesBrand;
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-black text-ink">Partner Petrol Stations</h1>
        <p className="text-xs text-ink-500">
          Network of certified gas stations supporting rider code redemption
        </p>
      </header>

      {/* Search Input */}
      <div className="field-box flex items-center gap-2 px-3 py-1">
        <Search className="h-4 w-4 text-ink-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by station name, area or code…"
          className="w-full text-xs font-semibold text-ink outline-none"
        />
      </div>

      {/* Brand Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedBrand(null)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
            !selectedBrand ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink hover:bg-gold/25"
          }`}
        >
          All Brands ({outlets.length})
        </button>
        {brands.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setSelectedBrand(b)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
              selectedBrand === b ? "bg-gold text-ink-gold" : "bg-gold/15 text-ink hover:bg-gold/25"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Stations List */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isCurrent = outlet?.id === item.id;
          const petrolPrice = item.prices.find((p) => p.product_id === "prod_petrol")?.price_per_unit;
          const dieselPrice = item.prices.find((p) => p.product_id === "prod_diesel")?.price_per_unit;

          return (
            <div key={item.id} className="home-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-navy/15 px-1.5 py-0.5 font-mono text-[10px] font-black text-navy dark:text-sky-300">
                      {item.code}
                    </span>
                    <h2 className="text-sm font-black text-ink">{item.name}</h2>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                    <MapPin className="h-3 w-3 shrink-0 text-gold" />
                    <span>{item.address}</span>
                  </p>
                </div>

                {isCurrent ? (
                  <span className="flex items-center gap-1 rounded-full bg-green/15 px-2.5 py-1 text-[11px] font-bold text-green">
                    <Check className="h-3 w-3" />
                    <span>Active</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectOutlet(item.id)}
                    className="rounded-full border border-[var(--border-faint)] px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-gold/15"
                  >
                    Select
                  </button>
                )}
              </div>

              {/* Station Pump Rates */}
              <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-faint)] pt-2.5 text-xs">
                <div>
                  <span className="text-ink-500">Petrol: </span>
                  <strong className="text-ink">
                    {petrolPrice ? ugx(petrolPrice) : "—"} / L
                  </strong>
                </div>
                <div>
                  <span className="text-ink-500">Diesel: </span>
                  <strong className="text-ink">
                    {dieselPrice ? ugx(dieselPrice) : "—"} / L
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
