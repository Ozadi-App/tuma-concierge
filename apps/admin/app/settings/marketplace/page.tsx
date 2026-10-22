"use client";

import { ModuleState } from "../../../components/ModuleState";
import { hasPermission, type MarketplaceSettings } from "@peebee/shared";
import { AlertCircle, CheckCircle2, Flame, Radio, ShoppingBag, Sparkles, Store, Tv, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SettingsPageShell } from "../../../components/SettingsPageShell";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

export default function MarketplaceSettingsPage() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.adminRole ?? null, "settings.manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState(10);
  const [proPricingMode, setProPricingMode] = useState<"free" | "paid">("free");
  const [proStorePriceUgx, setProStorePriceUgx] = useState(35000);
  const [proLivePriceUgx, setProLivePriceUgx] = useState(75000);
  const [proTrialDays, setProTrialDays] = useState(14);
  const [minOrderAmountUgx, setMinOrderAmountUgx] = useState(5000);
  const [deliveryBaseFeeUgx, setDeliveryBaseFeeUgx] = useState(3000);
  const [liveMaxDurationMins, setLiveMaxDurationMins] = useState(180);
  const [adMinBudgetUgx, setAdMinBudgetUgx] = useState(10000);
  const [adFeePercent, setAdFeePercent] = useState(5);
  const [cartExpiryHours, setCartExpiryHours] = useState(12);

  const load = useCallback(async () => {
    const res = await api.adminGetMarketplaceSettings();
    const m = res.marketplace;
    setEnabled(m.enabled);
    setLiveEnabled(m.liveEnabled);
    setCommissionPercent(m.commissionPercent);
    setProPricingMode(m.proPricingMode);
    setProStorePriceUgx(m.proStorePriceUgx);
    setProLivePriceUgx(m.proLivePriceUgx);
    setProTrialDays(m.proTrialDays);
    setMinOrderAmountUgx(m.minOrderAmountUgx);
    setDeliveryBaseFeeUgx(m.deliveryBaseFeeUgx);
    setLiveMaxDurationMins(m.liveMaxDurationMins);
    setAdMinBudgetUgx(m.adMinBudgetUgx);
    setAdFeePercent(m.adFeePercent);
    setCartExpiryHours(m.cartExpiryHours ?? 12);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (!Number.isInteger(cartExpiryHours) || cartExpiryHours < 1 || cartExpiryHours > 720) {
      setError("Earlier carts after (hours) must be a whole number from 1 to 720.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const payload: Partial<MarketplaceSettings> = {
        enabled,
        liveEnabled,
        commissionPercent,
        proPricingMode,
        proStorePriceUgx,
        proLivePriceUgx,
        proTrialDays,
        minOrderAmountUgx,
        deliveryBaseFeeUgx,
        liveMaxDurationMins,
        adMinBudgetUgx,
        adFeePercent,
        cartExpiryHours,
      };

      await api.adminUpdateMarketplaceSettings(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageShell title="Marketplace & Pro Stores" loading={loading}>
      <form onSubmit={handleSave} className="space-y-6 pb-12">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-3 rounded-2xl bg-green/10 p-4 text-sm font-semibold text-green">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>Marketplace and Pro Live settings successfully saved.</p>
          </div>
        )}

        {/* Master Switches */}
        <section className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Marketplace Service</h2>
              <p className="text-xs text-ink-500">Groceries & Stores customer channels and merchant storefronts</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-4">
            <div>
              <span className="block text-sm font-bold text-ink">Enable Marketplace</span>
              <span className="text-xs text-ink-500">Allow customers to browse stores and merchants to sell</span>
            </div>
            <ModuleState on={enabled} />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-faint)] pt-4">
            <div>
              <span className="block text-sm font-bold text-ink">Enable TikTok Live Commerce</span>
              <span className="text-xs text-ink-500">In-stream video selling, pinned catalog items & real-time chat</span>
            </div>
            <ModuleState on={liveEnabled} />
          </div>
        </section>

        {/* Pro Monetization & Paywall Gate */}
        <section className="rounded-[24px] border border-gold/30 bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Merchant Pro Paywall</h2>
                <p className="text-xs text-ink-500">Control whether Pro features are free or require subscription</p>
              </div>
            </div>

            {/* Free vs Paid Toggle */}
            <div className="flex rounded-full bg-[rgb(var(--surface-muted))] p-1 border border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => setProPricingMode("free")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  proPricingMode === "free"
                    ? "bg-gold text-ink-gold shadow-sm"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                Free Mode
              </button>
              <button
                type="button"
                onClick={() => setProPricingMode("paid")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  proPricingMode === "paid"
                    ? "bg-gold text-ink-gold shadow-sm"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                Paid Paywall
              </button>
            </div>
          </div>

          {proPricingMode === "free" ? (
            <div className="rounded-2xl bg-gold/10 p-4 text-xs text-ink space-y-1">
              <p className="font-bold text-gold">Promotional Launch Mode Active</p>
              <p className="text-ink-500">
                All merchants currently enjoy unlimited Pro features (Storefronts, Product Variants & TikTok Live
                Selling) for free without paying a subscription.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
                  <label className="text-xs font-bold text-ink-500 mb-1">Pro Store Monthly (UGX)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={proStorePriceUgx}
                    onChange={(e) => setProStorePriceUgx(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-ink outline-none text-base"
                  />
                  <span className="text-[10px] text-ink-500 mt-1">Unlimited catalog & variants</span>
                </div>

                <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
                  <label className="text-xs font-bold text-ink-500 mb-1">Pro Live Monthly (UGX)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={proLivePriceUgx}
                    onChange={(e) => setProLivePriceUgx(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-ink outline-none text-base"
                  />
                  <span className="text-[10px] text-ink-500 mt-1">TikTok Live & in-stream checkout</span>
                </div>

                <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
                  <label className="text-xs font-bold text-ink-500 mb-1">Free Trial Length (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={proTrialDays}
                    onChange={(e) => setProTrialDays(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-ink outline-none text-base"
                  />
                  <span className="text-[10px] text-ink-500 mt-1">Automatic trial for new stores</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Commissions & Delivery Rules */}
        <section className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Commissions & Order Rules</h2>
              <p className="text-xs text-ink-500">Platform take rates and checkout minimums</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Platform Commission (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">Share deducted from orders</span>
            </div>

            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Minimum Order Value (UGX)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={minOrderAmountUgx}
                onChange={(e) => setMinOrderAmountUgx(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">Default store checkout floor</span>
            </div>

            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Base Delivery Fee (UGX)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={deliveryBaseFeeUgx}
                onChange={(e) => setDeliveryBaseFeeUgx(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">Rider collection & dispatch floor</span>
            </div>

            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Earlier carts after (hours)</label>
              <input
                type="number"
                min={1}
                max={720}
                step={1}
                value={cartExpiryHours}
                onChange={(e) => setCartExpiryHours(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">
                A cart left this long is set aside as an earlier cart when the customer starts a new one. It stays retrievable.
              </span>
            </div>
          </div>
        </section>

        {/* Live Selling & Social Ads Engine Limits */}
        <section className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Live Broadcasts & Social Ads</h2>
              <p className="text-xs text-ink-500">Stream session windows and 1-click social ads budgets</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Max Stream Duration (Mins)</label>
              <input
                type="number"
                min={15}
                max={720}
                value={liveMaxDurationMins}
                onChange={(e) => setLiveMaxDurationMins(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">Continuous live broadcast limit</span>
            </div>

            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Min Ad Campaign Budget (UGX)</label>
              <input
                type="number"
                min={1000}
                step={5000}
                value={adMinBudgetUgx}
                onChange={(e) => setAdMinBudgetUgx(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">WhatsApp/Meta 1-click ads floor</span>
            </div>

            <div className="field-box flex flex-col p-3 rounded-2xl bg-[rgb(var(--surface-muted))]">
              <label className="text-xs font-bold text-ink-500 mb-1">Social Ads Platform Fee (%)</label>
              <input
                type="number"
                min={0}
                max={25}
                value={adFeePercent}
                onChange={(e) => setAdFeePercent(Number(e.target.value))}
                className="w-full bg-transparent font-bold text-ink outline-none text-base"
              />
              <span className="text-[10px] text-ink-500 mt-1">Ad management markup</span>
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="sticky bottom-4 z-20 flex gap-3">
          <button
            type="submit"
            disabled={!canManage || saving}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold px-6 text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] transition active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Marketplace Settings"}
          </button>
        </div>
      </form>
    </SettingsPageShell>
  );
}
