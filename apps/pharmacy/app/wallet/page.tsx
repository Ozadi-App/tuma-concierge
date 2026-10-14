"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  Lock,
  Phone,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

const ugx = (val: number) => `UGX ${val.toLocaleString()}`;

export default function PharmacyWalletPage() {
  const { pharmacy } = useAuth();
  const [balance, setBalance] = useState(1485000);
  const [pending, setPending] = useState(240000);
  const [cashoutModalOpen, setCashoutModalOpen] = useState(false);
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [cashoutPhone, setCashoutPhone] = useState("+256 772 110 220");
  const [cashoutPin, setCashoutPin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const handleCashout = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(cashoutAmount, 10);
    if (!amt || amt > balance) return;

    setBalance((prev) => prev - amt);
    setCashoutModalOpen(false);
    setCashoutAmount("");
    setCashoutPin("");
    setNotice(`Payout of ${ugx(amt)} initiated to ${cashoutPhone} via Mobile Money!`);
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-ink">Pharmacy Wallet & Payouts</h1>
        <p className="text-xs text-ink-500 font-medium">
          Daily sales settlements, mobile money cashout and transaction records
        </p>
      </div>

      {notice && (
        <div className="rounded-2xl bg-gold/15 p-3 text-xs font-bold text-ink flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Balance Hero Card */}
      <section className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/20 via-[rgb(var(--surface-card))] to-gold/5 p-6 shadow-sm space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-gold">
            Available Dispensing Balance
          </span>
          <p className="text-3xl font-black text-ink mt-1">{ugx(balance)}</p>
          <p className="text-xs text-ink-500 mt-1 font-medium">
            Pending Escrow Clearing: {ugx(pending)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCashoutModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-xs font-black text-ink-gold shadow transition hover:opacity-95 active:scale-98"
        >
          <ArrowUpRight className="h-4 w-4" />
          <span>Cashout to Mobile Money / Bank</span>
        </button>
      </section>

      {/* Linked Payout Accounts */}
      <section className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-ink uppercase tracking-wider">
          Primary Payout Account
        </h3>

        <div className="flex items-center justify-between rounded-2xl bg-[rgb(var(--surface-muted))] p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold font-black">
              MTN
            </div>
            <div>
              <p className="text-xs font-black text-ink">MTN Mobile Money</p>
              <p className="text-[11px] text-ink-500 font-mono">+256 772 110 220</p>
            </div>
          </div>
          <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold text-green-600">
            Verified
          </span>
        </div>
      </section>

      {/* Recent Ledger */}
      <section className="rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-ink uppercase tracking-wider">
          Recent Settlements & Orders
        </h3>

        <div className="space-y-2">
          {[
            { title: "Prescription Dispensed (#RX-01)", amt: 34500, time: "Today 11:20 AM", type: "credit" },
            { title: "OTC Medicine Cart (#ORD-881)", amt: 48500, time: "Today 09:45 AM", type: "credit" },
            { title: "Mobile Money Payout", amt: -500000, time: "Yesterday 06:10 PM", type: "debit" },
            { title: "Prescription Dispensed (#RX-89)", amt: 65000, time: "Yesterday 02:30 PM", type: "credit" },
          ].map((tx, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3"
            >
              <div>
                <p className="text-xs font-bold text-ink">{tx.title}</p>
                <p className="text-[10px] text-ink-500">{tx.time}</p>
              </div>
              <span
                className={`font-mono text-xs font-black ${
                  tx.type === "credit" ? "text-green-600" : "text-ink-500"
                }`}
              >
                {tx.amt > 0 ? `+${ugx(tx.amt)}` : ugx(tx.amt)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Cashout Drawer Modal */}
      {cashoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-ink">Cashout to Mobile Money</h3>

            <form onSubmit={handleCashout} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-500">Amount (UGX)</label>
                <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                  <input
                    type="number"
                    required
                    max={balance}
                    placeholder={`Max ${balance.toLocaleString()}`}
                    value={cashoutAmount}
                    onChange={(e) => setCashoutAmount(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-500">Destination Phone Number</label>
                <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                  <input
                    type="text"
                    required
                    value={cashoutPhone}
                    onChange={(e) => setCashoutPhone(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-500">Pharmacist Security PIN</label>
                <div className="field-box rounded-2xl border border-[var(--border-faint)]">
                  <input
                    type="password"
                    required
                    placeholder="Enter 4-digit PIN"
                    value={cashoutPin}
                    onChange={(e) => setCashoutPin(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-xs text-ink focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCashoutModalOpen(false)}
                  className="flex-1 rounded-2xl border border-[var(--border-faint)] py-2.5 text-xs font-bold text-ink-500 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-gold py-2.5 text-xs font-black text-ink-gold shadow transition hover:opacity-95"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
