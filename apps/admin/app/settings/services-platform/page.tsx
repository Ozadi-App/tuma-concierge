"use client";

import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Lock,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsPageShell, SettingsSaveBar } from "../../../components/SettingsPageShell";
import { Switch } from "../../../components/ui/Switch";
import { api, errorMessage, getStoredToken } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { hasPermission, type ServicesPlatformSettings } from "@peebee/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";

export default function ServicesPlatformSettingsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.adminRole ?? null, "settings.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Standalone Services Platform Settings State
  const [enabled, setEnabled] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState(5);
  const [leadTimeHours, setLeadTimeHours] = useState(2);
  const [maxServicesPerBusiness, setMaxServicesPerBusiness] = useState(50);
  const [disallowAggregatorForIntangibles, setDisallowAggregatorForIntangibles] = useState(true);
  const [virtualConsultationsEnabled, setVirtualConsultationsEnabled] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/v1/services-platform/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load services settings");
      const s = data.settings as ServicesPlatformSettings;
      setEnabled(s.enabled);
      setCommissionPercent(s.commissionPercent);
      setLeadTimeHours(s.leadTimeHours);
      setMaxServicesPerBusiness(s.maxServicesPerBusiness);
      setDisallowAggregatorForIntangibles(s.disallowAggregatorForIntangibles);
      setVirtualConsultationsEnabled(s.virtualConsultationsEnabled);
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/v1/services-platform/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enabled,
          commissionPercent: Number(commissionPercent),
          leadTimeHours: Number(leadTimeHours),
          maxServicesPerBusiness: Number(maxServicesPerBusiness),
          disallowAggregatorForIntangibles,
          virtualConsultationsEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageShell title="Services Platform & Aggregator Isolation" loading={loading}>
      <form onSubmit={onSubmit} className="space-y-6 max-w-4xl pb-24">
        {/* Intro Banner */}
        <div className="home-card space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gold-dark">
            <Briefcase className="h-4 w-4" />
            Standalone Service Engine Architecture
          </div>
          <h2 className="text-lg font-black text-ink">Independent Business Rail & Gateway Isolation</h2>
          <p className="text-xs text-ink-500 leading-relaxed">
            Services (consultations, appointments, field trades, custom quotations) operate on an independent
            infrastructure separated from the product catalog. This isolates international card aggregators (like Stripe)
            from intangible service chargeback disputes, while providing native direct Mobile Money and on-site settlement.
          </p>
        </div>

        {/* Global Module Switch */}
        <div className="home-card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-ink flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-600" />
                Services Platform Enabled
              </label>
              <p className="text-xs text-ink-500">
                When active, verified service providers can launch standalone booking sites and receive appointment inquiries.
              </p>
            </div>
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!canManage}
            />
          </div>
        </div>

        {/* Payment Aggregator Compliance & Intangibles Isolation */}
        <div className="home-card space-y-4 border-2 border-emerald-500/20 bg-emerald-50/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-black uppercase">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                Aggregator Risk Protection
              </div>
              <label className="text-sm font-bold text-ink block">
                Disallow Card Aggregators (Stripe) For Intangibles
              </label>
              <p className="text-xs text-ink-600 leading-relaxed">
                Aggregators strictly review non-physical services for dispute ratios. Enabling this rule guarantees
                that service bookings exclusively process through non-chargeback rails (MTN MoMo, Airtel Money, On-site cash),
                protecting the platform and merchant Stripe merchant accounts from suspension.
              </p>
            </div>
            <Switch
              checked={disallowAggregatorForIntangibles}
              onChange={(e) => setDisallowAggregatorForIntangibles(e.target.checked)}
              disabled={!canManage}
            />
          </div>

          <div className="p-3 rounded-xl bg-surface-primary border border-ink/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <span><strong>Products Rail:</strong> Stripe, Visa/MC + MoMo (Requires tracking proof)</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span><strong>Services Rail:</strong> Mobile Money Escrow & Cash (Zero chargeback risk)</span>
            </div>
          </div>
        </div>

        {/* Financial & Operational Dials */}
        <div className="home-card space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-ink">Platform Dials & Capacity</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">Platform Booking Fee (%)</label>
              <div className="field-box rounded-xl">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(Number(e.target.value))}
                  disabled={!canManage}
                  className="w-full p-2.5 text-xs text-ink outline-none"
                />
              </div>
              <p className="text-[11px] text-ink-400">Platform share retained upon completion</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">Min Lead Time (Hours)</label>
              <div className="field-box rounded-xl">
                <input
                  type="number"
                  min="0"
                  max="72"
                  value={leadTimeHours}
                  onChange={(e) => setLeadTimeHours(Number(e.target.value))}
                  disabled={!canManage}
                  className="w-full p-2.5 text-xs text-ink outline-none"
                />
              </div>
              <p className="text-[11px] text-ink-400">Advance notice before slot time</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">Max Services per Provider</label>
              <div className="field-box rounded-xl">
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={maxServicesPerBusiness}
                  onChange={(e) => setMaxServicesPerBusiness(Number(e.target.value))}
                  disabled={!canManage}
                  className="w-full p-2.5 text-xs text-ink outline-none"
                />
              </div>
              <p className="text-[11px] text-ink-400">Active catalog offerings limit</p>
            </div>
          </div>
        </div>

        {/* Feature Switches */}
        <div className="home-card space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-ink">Service Channels</h3>

          <div className="flex items-start justify-between gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-bold text-ink flex items-center gap-2">
                <Video className="h-4 w-4 text-sky-600" />
                Virtual Video Consultations (Google Meet / Zoom)
              </label>
              <p className="text-xs text-ink-500">
                Allows service practitioners to attach and auto-dispatch virtual meeting links for remote advisory sessions.
              </p>
            </div>
            <Switch
              checked={virtualConsultationsEnabled}
              onChange={(e) => setVirtualConsultationsEnabled(e.target.checked)}
              disabled={!canManage}
            />
          </div>
        </div>

        {/* Save Bar */}
        <SettingsSaveBar busy={saving} error={error} saved={saved} />
      </form>
    </SettingsPageShell>
  );
}
