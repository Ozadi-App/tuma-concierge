"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, ugx, useWorkPermissions } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";

import { Switch } from "../../../components/ui/Switch";

type LaundryItem = {
  id: string;
  name: string;
  category: string;
  washUgx: number | null;
  dryCleanUgx: number | null;
  ironUgx: number | null;
  maxCount: number;
  sortOrder: number;
  active: boolean;
};

type LaundryPackage = {
  id: string;
  name: string;
  description: string;
  minLb: number | null;
  maxLb: number | null;
  priceUgx: number;
  maxCount: number;
  sortOrder: number;
  active: boolean;
};

type LaundrySettings = {
  pricing: Record<string, "fixed" | "estimate">;
  offerMinPercent: number;
  offerMaxPercent: number;
  offerStepUgx: number;
  ridePayerPickup: "customer" | "provider" | "split";
  ridePayerDelivery: "customer" | "provider" | "split";
  rideSplitCustomerPercent: number;
  rideFeeUgx: number;
  overageUgxPerLb: number;
  tipFreeEnabled: boolean;
  tipConditionalEnabled: boolean;
  tipMaxUgx: number;
  tipOntimeHours: number;
  commissionTiming: "on_payout" | "at_checkout";
  cancelCommission: "refund" | "keep";
  providerCommissionPercent: number;
  customerFeeEnabled: boolean;
  customerFeeType: "flat" | "percent";
  customerFeeValue: number;
  customerFeeMaxSharePercent: number;
};

const digits = (v: string) => v.replace(/[^\d]/g, "");

export default function AdminLaundryPage() {
  const { canManage } = useWorkPermissions();
  const [tab, setTab] = useState<"settings" | "packages" | "items">("settings");

  const [settings, setSettings] = useState<LaundrySettings | null>(null);
  const [items, setItems] = useState<LaundryItem[]>([]);
  const [packages, setPackages] = useState<LaundryPackage[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editing state for item
  const [editingItem, setEditingItem] = useState<LaundryItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    name: string;
    category: string;
    washUgx: string;
    dryCleanUgx: string;
    ironUgx: string;
    maxCount: string;
    active: boolean;
  }>({ name: "", category: "clothing", washUgx: "", dryCleanUgx: "", ironUgx: "", maxCount: "50", active: true });

  // Editing state for package
  const [editingPkg, setEditingPkg] = useState<LaundryPackage | null>(null);
  const [pkgForm, setPkgForm] = useState<{
    name: string;
    description: string;
    minLb: string;
    maxLb: string;
    priceUgx: string;
    active: boolean;
  }>({ name: "", description: "", minLb: "", maxLb: "", priceUgx: "", active: true });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, iRes] = await Promise.all([api.workAdminLaundrySettings(), api.workAdminLaundryItems()]);
      setSettings(sRes.settings);
      setItems(iRes.items);
      setPackages(iRes.packages);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveSettings = async (partial: Partial<LaundrySettings>) => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.workAdminUpdateLaundrySettings(partial);
      setSettings(res.settings);
      setSuccess("Laundry settings saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;
    setSaving(true);
    setError(null);
    try {
      await api.workAdminUpdateLaundryItem(editingItem.id, {
        name: itemForm.name,
        category: itemForm.category,
        washUgx: itemForm.washUgx ? Number(itemForm.washUgx) : null,
        dryCleanUgx: itemForm.dryCleanUgx ? Number(itemForm.dryCleanUgx) : null,
        ironUgx: itemForm.ironUgx ? Number(itemForm.ironUgx) : null,
        maxCount: Number(itemForm.maxCount) || 50,
        active: itemForm.active,
      });
      setEditingItem(null);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePackage = async () => {
    if (!editingPkg) return;
    setSaving(true);
    setError(null);
    try {
      await api.workAdminUpdateLaundryPackage(editingPkg.id, {
        name: pkgForm.name,
        description: pkgForm.description,
        minLb: pkgForm.minLb ? Number(pkgForm.minLb) : null,
        maxLb: pkgForm.maxLb ? Number(pkgForm.maxLb) : null,
        priceUgx: Number(pkgForm.priceUgx) || 0,
        active: pkgForm.active,
      });
      setEditingPkg(null);
      await loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-ink-500">Loading laundry configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Subnav */}
      <div className="flex gap-2 border-b border-[var(--border-faint)] pb-3">
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "settings" ? "bg-gold text-ink" : "bg-[var(--surface-sunken)] text-ink-500 hover:text-ink"
          }`}
        >
          Pricing & Rules
        </button>
        <button
          type="button"
          onClick={() => setTab("packages")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "packages" ? "bg-gold text-ink" : "bg-[var(--surface-sunken)] text-ink-500 hover:text-ink"
          }`}
        >
          Packages ({packages.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("items")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            tab === "items" ? "bg-gold text-ink" : "bg-[var(--surface-sunken)] text-ink-500 hover:text-ink"
          }`}
        >
          Clothes Catalogue ({items.length})
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {success && <div className="rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600">{success}</div>}

      {/* Settings Tab */}
      {tab === "settings" && settings && (
        <div className="space-y-6">
          {/* Pricing Modes */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-4 space-y-4">
            <h2 className="text-sm font-bold text-ink">Pricing Modes (Fixed vs Estimate)</h2>
            <p className="text-xs text-ink-500">
              Fixed mode applies set catalogue rates. Estimate mode allows the customer to submit an offer within the min/max slider band.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["wash_fold", "dry_clean", "iron", "custom"] as const).map((svc) => (
                <div key={svc} className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] p-3">
                  <div>
                    <span className="text-xs font-bold text-ink capitalize">{svc.replace("_", " & ")}</span>
                    <p className="text-[10px] text-ink-500">{settings.pricing[svc] === "fixed" ? "Admin sets exact price" : "Customer can make offer"}</p>
                  </div>
                  <select
                    value={settings.pricing[svc]}
                    onChange={(val) => void saveSettings({ pricing: { ...settings.pricing, [svc]: val as any } })}
                    disabled={!canManage || saving}
                    className="w-32 text-xs"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="estimate">Estimate (Offer)</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Offer Band Settings */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-4 space-y-3">
            <h2 className="text-sm font-bold text-ink">Offer Slider Band</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Min Offer (%)">
                <input
                  type="text"
                  value={settings.offerMinPercent}
                  onChange={(e) => void saveSettings({ offerMinPercent: Number(digits(e.target.value)) })}
                  disabled={!canManage || saving}
                  className={inputCls}
                />
              </Field>
              <Field label="Max Offer (%)">
                <input
                  type="text"
                  value={settings.offerMaxPercent}
                  onChange={(e) => void saveSettings({ offerMaxPercent: Number(digits(e.target.value)) })}
                  disabled={!canManage || saving}
                  className={inputCls}
                />
              </Field>
              <Field label="Slider Step (UGX)">
                <input
                  type="text"
                  value={settings.offerStepUgx}
                  onChange={(e) => void saveSettings({ offerStepUgx: Number(digits(e.target.value)) })}
                  disabled={!canManage || saving}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* Commission & Fee Rules */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-4 space-y-4">
            <h2 className="text-sm font-bold text-ink">Peebee Commission & Service Fee</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Field label="Provider Commission (%)">
                  <input
                    type="text"
                    value={settings.providerCommissionPercent}
                    onChange={(e) => void saveSettings({ providerCommissionPercent: Number(digits(e.target.value)) })}
                    disabled={!canManage || saving}
                    className={inputCls}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] p-3">
                  <div>
                    <span className="text-xs font-bold text-ink">Commission Timing</span>
                    <p className="text-[10px] text-ink-500">
                      {settings.commissionTiming === "at_checkout" ? "Taken immediately at customer checkout" : "Withheld from provider payout"}
                    </p>
                  </div>
                  <select
                    value={settings.commissionTiming}
                    onChange={(val) => void saveSettings({ commissionTiming: val as any })}
                    disabled={!canManage || saving}
                    className="w-36 text-xs"
                  >
                    <option value="on_payout">On Payout</option>
                    <option value="at_checkout">At Checkout</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] p-3">
                  <div>
                    <span className="text-xs font-bold text-ink">Cancellation Rule</span>
                    <p className="text-[10px] text-ink-500">
                      {settings.cancelCommission === "refund" ? "Full refund to customer" : "Peebee keeps checkout fees"}
                    </p>
                  </div>
                  <select
                    value={settings.cancelCommission}
                    onChange={(val) => void saveSettings({ cancelCommission: val as any })}
                    disabled={!canManage || saving}
                    className="w-32 text-xs"
                  >
                    <option value="refund">Refund All</option>
                    <option value="keep">Keep Fees</option>
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--border-faint)] p-3">
                  <div>
                    <span className="text-xs font-bold text-ink">Customer Checkout Fee</span>
                    <p className="text-[10px] text-ink-500">Automatic surcharge added at checkout</p>
                  </div>
                  <Switch
                    checked={settings.customerFeeEnabled}
                    onChange={(e) => void saveSettings({ customerFeeEnabled: e.target.checked })}
                    disabled={!canManage || saving}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Rider Splits */}
          <div className="rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-4 space-y-4">
            <h2 className="text-sm font-bold text-ink">Logistics & Rider Ride Fees</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Pickup Ride Payer">
                <select
                  value={settings.ridePayerPickup}
                  onChange={(val) => void saveSettings({ ridePayerPickup: val as any })}
                  disabled={!canManage || saving}
                  className="w-full text-xs"
                >
                  <option value="customer">Customer Pays</option>
                  <option value="provider">Provider Pays</option>
                  <option value="split">Split</option>
                </select>
              </Field>
              <Field label="Delivery Ride Payer">
                <select
                  value={settings.ridePayerDelivery}
                  onChange={(val) => void saveSettings({ ridePayerDelivery: val as any })}
                  disabled={!canManage || saving}
                  className="w-full text-xs"
                >
                  <option value="customer">Customer Pays</option>
                  <option value="provider">Provider Pays</option>
                  <option value="split">Split</option>
                </select>
              </Field>
              <Field label="Ride Fee (UGX per leg)">
                <input
                  type="text"
                  value={settings.rideFeeUgx}
                  onChange={(e) => void saveSettings({ rideFeeUgx: Number(digits(e.target.value)) })}
                  disabled={!canManage || saving}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* Packages Tab */}
      {tab === "packages" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex flex-col justify-between rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{pkg.name}</span>
                    <Badge tone={pkg.active && pkg.priceUgx > 0 ? "active" : "muted"}>
                      {pkg.active && pkg.priceUgx > 0 ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{pkg.description || "No description"}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-ink-500">Weight Capacity:</span>
                    <span className="font-medium text-ink">{pkg.minLb && pkg.maxLb ? `${pkg.minLb}–${pkg.maxLb} lbs` : "Flexible"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-ink-500">Base Price:</span>
                    <span className="font-bold text-ink">{ugx(pkg.priceUgx)}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-faint)] flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPkg(pkg);
                      setPkgForm({
                        name: pkg.name,
                        description: pkg.description,
                        minLb: pkg.minLb ? String(pkg.minLb) : "",
                        maxLb: pkg.maxLb ? String(pkg.maxLb) : "",
                        priceUgx: String(pkg.priceUgx),
                        active: pkg.active,
                      });
                    }}
                    className="rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gold/20"
                  >
                    Edit Package
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clothes Catalogue Tab */}
      {tab === "items" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-faint)] bg-[var(--surface-sunken)] text-ink-500">
                <tr>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Wash Price</th>
                  <th className="p-3">Dry Clean Price</th>
                  <th className="p-3">Iron Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-faint)]">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-sunken)]/50">
                    <td className="p-3 font-semibold text-ink">{item.name}</td>
                    <td className="p-3 text-ink-500 capitalize">{item.category}</td>
                    <td className="p-3 text-ink">{item.washUgx ? ugx(item.washUgx) : "—"}</td>
                    <td className="p-3 text-ink">{item.dryCleanUgx ? ugx(item.dryCleanUgx) : "—"}</td>
                    <td className="p-3 text-ink">{item.ironUgx ? ugx(item.ironUgx) : "—"}</td>
                    <td className="p-3">
                      <Badge tone={item.active ? "active" : "muted"}>{item.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setItemForm({
                            name: item.name,
                            category: item.category,
                            washUgx: item.washUgx ? String(item.washUgx) : "",
                            dryCleanUgx: item.dryCleanUgx ? String(item.dryCleanUgx) : "",
                            ironUgx: item.ironUgx ? String(item.ironUgx) : "",
                            maxCount: String(item.maxCount),
                            active: item.active,
                          });
                        }}
                        className="rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-ink hover:bg-gold/20"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink">Edit Item: {editingItem.name}</h3>
            <div className="space-y-3">
              <Field label="Name">
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Wash (UGX)">
                  <input
                    type="text"
                    value={itemForm.washUgx}
                    onChange={(e) => setItemForm({ ...itemForm, washUgx: digits(e.target.value) })}
                    placeholder="None"
                    className={inputCls}
                  />
                </Field>
                <Field label="Dry Clean (UGX)">
                  <input
                    type="text"
                    value={itemForm.dryCleanUgx}
                    onChange={(e) => setItemForm({ ...itemForm, dryCleanUgx: digits(e.target.value) })}
                    placeholder="None"
                    className={inputCls}
                  />
                </Field>
                <Field label="Iron (UGX)">
                  <input
                    type="text"
                    value={itemForm.ironUgx}
                    onChange={(e) => setItemForm({ ...itemForm, ironUgx: digits(e.target.value) })}
                    placeholder="None"
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-ink">Active in Customer Menu</span>
                <Switch checked={itemForm.active} onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-ink-500 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveItem()}
                disabled={saving}
                className="rounded-xl bg-gold px-4 py-2 text-xs font-bold text-ink"
              >
                {saving ? "Saving..." : "Save Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-faint)] bg-[var(--surface-raised)] p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink">Edit Package: {editingPkg.name}</h3>
            <div className="space-y-3">
              <Field label="Name">
                <input
                  type="text"
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <input
                  type="text"
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Min Lb">
                  <input
                    type="text"
                    value={pkgForm.minLb}
                    onChange={(e) => setPkgForm({ ...pkgForm, minLb: digits(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Max Lb">
                  <input
                    type="text"
                    value={pkgForm.maxLb}
                    onChange={(e) => setPkgForm({ ...pkgForm, maxLb: digits(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Price (UGX)">
                  <input
                    type="text"
                    value={pkgForm.priceUgx}
                    onChange={(e) => setPkgForm({ ...pkgForm, priceUgx: digits(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-ink">Active</span>
                <Switch checked={pkgForm.active} onChange={(e) => setPkgForm({ ...pkgForm, active: e.target.checked })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-ink-500 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSavePackage()}
                disabled={saving}
                className="rounded-xl bg-gold px-4 py-2 text-xs font-bold text-ink"
              >
                {saving ? "Saving..." : "Save Package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
