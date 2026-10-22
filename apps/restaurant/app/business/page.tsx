"use client";

import { FOOD_BUSINESS_TYPES, type FoodBusinessType, type Restaurant } from "@peebee/shared";
import { Eye, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BusinessStyleEditor } from "../../components/BusinessStyleEditor";
import { CoverEditor } from "../../components/CoverEditor";
import { LogoEditor } from "../../components/LogoEditor";
import { toast } from "../../components/shell/Toaster";
import { Card, Field, PageHeader, SaveBar } from "../../components/ui/Page";
import { Switch } from "../../components/ui/Switch";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

const LocationMapPicker = dynamic(() => import("../../components/LocationMapPicker").then((m) => m.LocationMapPicker), { ssr: false });

const STATUS_LABEL: Record<Restaurant["status"], string> = { pending_approval: "Pending approval", active: "Live on Peebee", suspended: "Suspended" };
const field = "w-full rounded-xl border border-[var(--border-faint)] px-3 py-2.5 text-[15px] outline-none focus:border-gold";

/** Business profile: open status, photos, colour theme and details in one ordered page. */
export default function BusinessPage() {
  const { restaurant: authRestaurant, refreshRestaurant } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(authRestaurant);
  const [businessType, setBusinessType] = useState<FoodBusinessType | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myRestaurant().then((res) => applyRestaurant(res.restaurant)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRestaurant(r: Restaurant) {
    setRestaurant(r);
    setName(r.name);
    setBusinessType(r.business_type ?? "restaurant");
    setDescription(r.description ?? "");
    setCuisine(r.cuisine ?? "");
    setPhone(r.phone ?? "");
    setAddress(r.address ?? "");
    if (r.lat != null && r.lng != null) setCoords({ lat: r.lat, lng: r.lng });
    setOpenTime(r.open_time ?? "");
    setCloseTime(r.close_time ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!businessType) throw new Error("Choose your food business type.");
      const input = {
        businessType, name,
        description: description || undefined, cuisine: cuisine || undefined, phone: phone || undefined, address: address || undefined,
        lat: coords?.lat, lng: coords?.lng,
        openTime: openTime || null, closeTime: closeTime || null,
      };
      const res = restaurant ? await api.updateRestaurant(input) : await api.applyAsRestaurant(input);
      applyRestaurant(res.restaurant);
      await refreshRestaurant();
      toast(restaurant ? "Business profile saved" : "Food business registered");
    } catch (err) {
      setError(errorMessage(err));
      toast("Could not save your profile", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOpen(isOpen: boolean) {
    if (!restaurant) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.updateRestaurant({ isOpen });
      applyRestaurant(res.restaurant);
      await refreshRestaurant();
      toast(isOpen ? "Open for new orders" : "Closed to new orders");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const reload = async () => { const res = await api.myRestaurant(); setRestaurant(res.restaurant); await refreshRestaurant(); };

  return (
    <div className="space-y-5 px-4 pb-6 pt-4 lg:px-8">
      <PageHeader eyebrow="Storefront" title={restaurant ? "Business profile" : "Register your food business"}
        description={restaurant ? "What customers see about you, and when you take orders." : "Tell customers who you are. An admin reviews new businesses."}
        actions={restaurant ? <Link href="/preview" className="rs-btn rs-btn-ghost !min-h-10 !px-3 text-xs"><Eye size={15} /> Preview</Link> : undefined} />

      {restaurant && (
        <Card id="status">
          <div className="rs-row">
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-ink">{STATUS_LABEL[restaurant.status]}</span>
              <span className="block text-xs text-ink-500">
                {restaurant.status === "pending_approval" ? "An admin needs to approve your food business before customers can see it."
                  : restaurant.status === "suspended" ? "Contact support if you think this is a mistake."
                  : restaurant.is_open ? "Customers can order now." : "Customers can browse but not order."}
              </span>
            </span>
            {restaurant.status === "active" && (
              <Switch aria-label="Open for new orders" checked={!!restaurant.is_open} onChange={(e) => toggleOpen(e.target.checked)} disabled={busy} />
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {restaurant && <div id="photos" className="scroll-mt-24 space-y-5"><CoverEditor restaurant={restaurant} onSaved={reload} /><LogoEditor restaurant={restaurant} onSaved={reload} /></div>}
        </div>
        <div className="space-y-5">
          {restaurant && <BusinessStyleEditor restaurant={restaurant} onSaved={reload} />}
        </div>
      </div>

      <form id="details" onSubmit={submit} className="scroll-mt-24 space-y-5">
        <Card title="What you serve" description="Customers find you under this food category.">
          <fieldset className="food-type-picker">
            <legend className="sr-only">What kind of food business do you run?</legend>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {FOOD_BUSINESS_TYPES.map((type) => (
                <label key={type.value} className={`food-type-option ${businessType === type.value ? "selected" : ""}`}>
                  <input type="radio" name="businessType" required value={type.value} checked={businessType === type.value} onChange={() => setBusinessType(type.value)} />
                  <span className="block font-bold">{type.label}</span>
                  <span className="mt-1 block text-xs text-ink-500">{type.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
        <Card title="Details" description="Your name, contact and a short line about your food.">
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Name" required><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kampala Kitchen" className={field} /></Field>
            <Field label="Cuisine"><input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="e.g. Ugandan, fast food, pizza" className={field} /></Field>
            <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short line about your food business" className={field} /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256…" className={field} /></Field>
          </div>
        </Card>
        <Card title="Hours" description="Your business opens and closes automatically at these times (Uganda time), even when the app is closed. A manual change lasts until the next scheduled time. Leave both empty for manual control.">
          <div className="flex items-center gap-2">
            <input type="time" aria-label="Opening time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className={field} />
            <span className="text-sm text-ink-500">to</span>
            <input type="time" aria-label="Closing time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className={field} />
          </div>
        </Card>
        <Card title="Pickup location" description="Where a rider collects your orders.">
          <Field label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area" className={field} /></Field>
          <button type="button" onClick={() => setShowMap(true)} className="rs-btn rs-btn-ghost w-full"><MapPin className="h-4 w-4" aria-hidden />{coords ? "Change pickup location" : "Set pickup location"}</button>
          {coords && <p className="text-xs text-ink-500">Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}.</p>}
        </Card>
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <SaveBar note={restaurant ? "Changes apply when you save." : "An admin reviews new businesses."}>
          <button type="submit" disabled={busy || !name.trim() || !businessType} className="rs-btn rs-btn-gold">
            {busy ? "Saving…" : restaurant ? "Save changes" : "Register food business"}
          </button>
        </SaveBar>
      </form>

      {showMap && (
        <LocationMapPicker initial={coords ?? undefined} onCancel={() => setShowMap(false)}
          onConfirm={(loc) => { setCoords({ lat: loc.lat, lng: loc.lng }); setAddress(loc.address ?? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`); setShowMap(false); }} />
      )}
    </div>
  );
}
