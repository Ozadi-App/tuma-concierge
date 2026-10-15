"use client";

import type { WorkAdminService, WorkAdminServiceInput, WorkPricingMode, WorkServiceType } from "@peebee/shared";
import { useCallback, useEffect, useState } from "react";
import { Badge, ConfirmDialog, ErrorNote, Field, inputCls, label, ugx, useWorkPermissions } from "../../../components/work/ui";
import { api, errorMessage } from "../../../lib/api";

const TYPES: WorkServiceType[] = ["clean", "fix", "laundry"];
const MODES: WorkPricingMode[] = ["fixed", "quote"];

type Form = {
  type: WorkServiceType;
  category: string;
  name: string;
  description: string;
  pricingMode: WorkPricingMode;
  unitLabel: string;
  unitPriceUgx: string;
  calloutFeeUgx: string;
  minQuantity: string;
  maxQuantity: string;
  commissionPercent: string; // blank = use the global rate
  sortOrder: string;
  active: boolean;
};

const EMPTY: Form = {
  type: "clean", category: "", name: "", description: "", pricingMode: "fixed", unitLabel: "job",
  unitPriceUgx: "0", calloutFeeUgx: "0", minQuantity: "1", maxQuantity: "20", commissionPercent: "", sortOrder: "0", active: true,
};

const fromService = (s: WorkAdminService): Form => ({
  type: s.type, category: s.category, name: s.name, description: s.description, pricingMode: s.pricing_mode, unitLabel: s.unit_label,
  unitPriceUgx: String(s.unit_price_ugx), calloutFeeUgx: String(s.callout_fee_ugx), minQuantity: String(s.min_quantity), maxQuantity: String(s.max_quantity),
  commissionPercent: s.commission_percent == null ? "" : String(s.commission_percent), sortOrder: String(s.sort_order), active: !!s.active,
});

const digits = (v: string) => v.replace(/[^\d]/g, "");

/** Client-side mirror of the API's field ranges so mistakes show before saving. */
function validate(f: Form): string | null {
  const n = (v: string) => Number(v);
  if (f.name.trim().length < 2) return "Give the service a name (2+ characters).";
  if (!f.unitLabel.trim()) return "Add a unit label.";
  if (n(f.unitPriceUgx) > 100_000_000) return "Unit price is too high.";
  if (n(f.calloutFeeUgx) > 10_000_000) return "Call-out fee is too high.";
  if (n(f.minQuantity) < 1 || n(f.maxQuantity) < 1 || n(f.minQuantity) > 1000 || n(f.maxQuantity) > 1000) return "Quantities must be between 1 and 1000.";
  if (n(f.minQuantity) > n(f.maxQuantity)) return "The minimum can't be more than the maximum.";
  if (f.pricingMode === "fixed" && !(n(f.unitPriceUgx) > 0)) return "A fixed-price service needs a price.";
  if (f.commissionPercent !== "" && (Number(f.commissionPercent) < 0 || Number(f.commissionPercent) > 60 || Number.isNaN(Number(f.commissionPercent)))) return "Commission override must be 0-60%.";
  if (n(f.sortOrder) > 100000) return "Sort order is too high.";
  return null;
}

function toInput(f: Form): WorkAdminServiceInput {
  return {
    type: f.type, category: f.category.trim(), name: f.name.trim(), description: f.description.trim(), pricingMode: f.pricingMode, unitLabel: f.unitLabel.trim(),
    unitPriceUgx: Number(f.unitPriceUgx), calloutFeeUgx: Number(f.calloutFeeUgx), minQuantity: Number(f.minQuantity), maxQuantity: Number(f.maxQuantity),
    commissionPercent: f.commissionPercent === "" ? null : Number(f.commissionPercent), sortOrder: Number(f.sortOrder), active: f.active,
  };
}

export default function WorkCataloguePage() {
  const { canManage } = useWorkPermissions();
  const [type, setType] = useState("");
  const [services, setServices] = useState<WorkAdminService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .workAdminServices((type || undefined) as WorkServiceType | undefined)
      .then((r) => setServices(r.services))
      .catch((err) => setError(errorMessage(err)));
  }, [type]);

  useEffect(() => {
    setServices(null);
    load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  async function save() {
    if (!editing) return;
    const problem = validate(editing.form);
    if (problem) return setDialogError(problem);
    setBusy(true);
    setDialogError(null);
    try {
      const body = toInput(editing.form);
      if (editing.id) await api.workAdminUpdateService(editing.id, body);
      else await api.workAdminCreateService(body);
      setEditing(null);
      load();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const f = editing?.form;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select aria-label="Service type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </select>
        {canManage && (
          <button
            type="button"
            onClick={() => { setDialogError(null); setEditing({ id: null, form: { ...EMPTY, type: (type || "clean") as WorkServiceType } }); }}
            className="min-h-11 shrink-0 rounded-full bg-gold px-4 text-sm font-bold text-ink-gold"
          >
            New service
          </button>
        )}
      </div>
      <ErrorNote message={error} />
      {services === null && !error && <p className="text-sm text-ink-500">Loading…</p>}
      {services && services.length === 0 && <p className="text-sm text-ink-500">No services yet.</p>}
      <ul className="space-y-2">
        {(services ?? []).map((s) => (
          <li key={s.id} className="home-card space-y-1 !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[15px] font-bold text-ink">{s.name}</p>
              <Badge tone={s.active ? "good" : "neutral"}>{s.active ? "active" : "off"}</Badge>
            </div>
            <p className="text-xs text-ink-500">
              {label(s.type)}{s.category ? ` · ${s.category}` : ""} · {label(s.pricing_mode)}
            </p>
            <p className="text-xs text-ink-500">
              {s.pricing_mode === "fixed" ? `${ugx(s.unit_price_ugx)} per ${s.unit_label}` : `Call-out ${ugx(s.callout_fee_ugx)}`}
              {s.pricing_mode === "fixed" && s.callout_fee_ugx > 0 ? ` + call-out ${ugx(s.callout_fee_ugx)}` : ""} · {s.min_quantity}-{s.max_quantity} {s.unit_label}
              {s.commission_percent != null ? ` · ${s.commission_percent}% commission` : ""}
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => { setDialogError(null); setEditing({ id: s.id, form: fromService(s) }); }}
                className="mt-1 min-h-9 rounded-full border border-[var(--border-faint)] px-3.5 text-xs font-bold text-ink"
              >
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>

      {editing && f && (
        <ConfirmDialog
          title={editing.id ? "Edit service" : "New service"}
          confirmLabel="Save"
          busy={busy}
          error={dialogError}
          onClose={() => setEditing(null)}
          onConfirm={save}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={f.type} onChange={(e) => set("type", e.target.value as WorkServiceType)} className={inputCls}>
                {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </Field>
            <Field label="Pricing mode">
              <select value={f.pricingMode} onChange={(e) => set("pricingMode", e.target.value as WorkPricingMode)} className={inputCls}>
                {MODES.map((m) => <option key={m} value={m}>{label(m)}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Name"><input value={f.name} maxLength={100} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Category"><input value={f.category} maxLength={40} onChange={(e) => set("category", e.target.value)} className={inputCls} /></Field>
            <Field label="Unit label"><input value={f.unitLabel} maxLength={30} onChange={(e) => set("unitLabel", e.target.value)} className={inputCls} /></Field>
            <div className="col-span-2">
              <Field label="Description"><textarea value={f.description} rows={2} maxLength={300} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Unit price (UGX)" hint={f.pricingMode === "fixed" ? "Required for fixed price" : "Not used for quotes"}>
              <input inputMode="numeric" value={f.unitPriceUgx} onChange={(e) => set("unitPriceUgx", digits(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Call-out fee (UGX)"><input inputMode="numeric" value={f.calloutFeeUgx} onChange={(e) => set("calloutFeeUgx", digits(e.target.value))} className={inputCls} /></Field>
            <Field label="Min quantity"><input inputMode="numeric" value={f.minQuantity} onChange={(e) => set("minQuantity", digits(e.target.value))} className={inputCls} /></Field>
            <Field label="Max quantity"><input inputMode="numeric" value={f.maxQuantity} onChange={(e) => set("maxQuantity", digits(e.target.value))} className={inputCls} /></Field>
            <Field label="Commission override (%)" hint="Blank uses the Work settings rate">
              <input inputMode="decimal" value={f.commissionPercent} onChange={(e) => set("commissionPercent", e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} />
            </Field>
            <Field label="Sort order"><input inputMode="numeric" value={f.sortOrder} onChange={(e) => set("sortOrder", digits(e.target.value))} className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />
            Active (customers can book it)
          </label>
          <p className="text-xs text-ink-500">Changes only affect new bookings; jobs already booked keep their price.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
