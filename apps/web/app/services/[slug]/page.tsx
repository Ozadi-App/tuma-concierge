"use client";

import {
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  ShieldCheck,
  Video,
  X,
  Building,
  Check,
  Smartphone,
  AlertCircle,
  Sparkles,
  ChevronRight,
  MessageCircle,
  HelpCircle,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  ServiceBusinessProfile,
  ServiceOffering,
  ServiceStaffMember,
  ServicePaymentRail,
} from "@peebee/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.peebee.online";

const ugx = (n: number) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

export default function DedicatedServiceSitePage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [business, setBusiness] = useState<ServiceBusinessProfile | null>(null);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [staff, setStaff] = useState<ServiceStaffMember[]>([]);

  // Category filter
  const [selectedCat, setSelectedCat] = useState<string>("all");

  // Booking modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<ServiceOffering | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentRail, setPaymentRail] = useState<ServicePaymentRail>("momo_mtn");
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/v1/services-platform/public/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.message || "Service site not found");
        }
        return r.json();
      })
      .then((data) => {
        setBusiness(data.business);
        setOfferings(data.offerings || []);
        setStaff(data.staff || []);
        if (data.business?.allowed_payment_rails?.length > 0) {
          setPaymentRail(data.business.allowed_payment_rails[0]);
        }
      })
      .catch((err) => {
        setError(err.message || "Could not load service provider site.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  async function handleBookService(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOffering || !business) return;
    setSubmittingBooking(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/services-platform/public/${encodeURIComponent(slug)}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedOffering.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          location_type: selectedOffering.location_type,
          address: address || business.address,
          notes,
          payment_rail: paymentRail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Booking could not be confirmed");
      setBookingSuccess(data.booking);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingBooking(false);
    }
  }

  const filteredOfferings = offerings.filter((o) => {
    if (selectedCat === "all") return true;
    return o.category === selectedCat;
  });

  const categories = ["all", ...Array.from(new Set(offerings.map((o) => o.category)))];

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="space-y-3 text-center">
          <div className="h-10 w-10 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">Connecting to service site...</p>
        </div>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-surface-primary border border-ink/10 p-8 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-black text-ink">Service Site Unavailable</h2>
          <p className="text-xs text-ink-500">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink text-cream px-4 py-2 text-xs font-bold"
          >
            Go to Peebee Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Top Notice Bar */}
      <div className="bg-ink text-cream px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-ink/20">
        <div className="flex items-center gap-2 mx-auto max-w-4xl w-full">
          <ShieldCheck className="h-4 w-4 text-gold shrink-0" />
          <span className="truncate">
            Verified Service Provider · Direct Mobile Money Escrow & Carrier Push Protection
          </span>
        </div>
      </div>

      {/* Hero Banner & Business Info */}
      <header className="border-b border-ink/10 bg-surface-primary">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 rounded-2xl bg-gold/20 flex items-center justify-center shrink-0 border border-gold/30 text-gold-dark font-black text-2xl shadow-sm">
                {business?.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt={business.name}
                    className="h-full w-full object-cover rounded-2xl"
                  />
                ) : (
                  business?.name?.slice(0, 2).toUpperCase() || "SP"
                )}
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-black uppercase">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Licensed Specialist</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">{business?.name}</h1>
                <p className="text-xs font-bold text-ink-600">{business?.tagline}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500 pt-1">
                  <span className="flex items-center gap-1 font-semibold text-ink-600">
                    <MapPin className="h-3.5 w-3.5 text-ink-400" />
                    {business?.service_area}
                  </span>
                  {business?.address && (
                    <>
                      <span>•</span>
                      <span>{business.address}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {business?.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-surface-primary px-3.5 py-2 text-xs font-bold text-ink hover:bg-ink/5 transition-colors shadow-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call Office</span>
                </a>
              )}
              {business?.whatsapp && (
                <a
                  href={`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {business?.description && (
            <p className="text-xs text-ink-600 leading-relaxed max-w-2xl border-t border-ink/5 pt-4">
              {business.description}
            </p>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Category Pills */}
        {categories.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCat(c)}
                className={`rounded-xl px-4 py-2 text-xs font-bold capitalize transition-colors ${
                  selectedCat === c ? "bg-ink text-cream" : "bg-surface-primary border border-ink/10 text-ink-600"
                }`}
              >
                {c.replace("_", " ")}
              </button>
            ))}
          </div>
        )}

        {/* Services List */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-ink">Available Services & Consultations</h2>
            <p className="text-xs text-ink-500">Select a service to schedule your appointment or request a project quotation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOfferings.map((offering) => (
              <div
                key={offering.id}
                className="rounded-3xl border border-ink/10 bg-surface-primary p-6 shadow-sm space-y-4 flex flex-col justify-between hover:border-gold/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 text-[10px] font-black uppercase text-ink-600">
                      {offering.location_type === "virtual" ? (
                        <Video className="h-3 w-3 text-sky-600" />
                      ) : offering.location_type === "client_site" ? (
                        <MapPin className="h-3 w-3 text-amber-600" />
                      ) : (
                        <Building className="h-3 w-3 text-emerald-600" />
                      )}
                      <span>{offering.location_type.replace("_", " ")}</span>
                    </span>

                    <span className="text-[11px] font-bold text-ink-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {offering.duration_minutes} mins
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink">{offering.title}</h3>
                  <p className="text-xs text-ink-500 leading-relaxed line-clamp-3">{offering.description}</p>

                  {offering.deliverables && offering.deliverables.length > 0 && (
                    <div className="pt-2 border-t border-ink/5 space-y-1">
                      <div className="text-[10px] uppercase font-bold text-ink-400">Deliverables Included:</div>
                      <ul className="text-xs text-ink-600 space-y-1">
                        {offering.deliverables.map((d, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-ink/5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-ink-400">
                      {offering.pricing_type === "custom_quote"
                        ? "Custom Quotation"
                        : offering.pricing_type === "hourly"
                        ? "Hourly Rate"
                        : "Fixed Fee"}
                    </div>
                    <div className="text-base font-black text-ink">
                      {offering.pricing_type === "custom_quote" ? "Free Inquiry" : ugx(offering.price_ugx)}
                      {offering.pricing_type === "hourly" && <span className="text-xs font-normal text-ink-500"> / hr</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedOffering(offering);
                      setBookingModalOpen(true);
                      setBookingSuccess(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-xs font-black text-black shadow hover:bg-gold-light active:scale-98 transition-all"
                  >
                    <span>{offering.pricing_type === "custom_quote" ? "Request Quote" : "Book Service"}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Specialists Section */}
        {staff.length > 0 && (
          <div className="rounded-3xl border border-ink/10 bg-surface-primary p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-base font-black text-ink">Our Certified Practitioners & Team</h2>
              <p className="text-xs text-ink-500">Dedicated professionals assigned to your appointment</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {staff.map((s) => (
                <div key={s.id} className="p-3 rounded-2xl bg-cream/70 border border-ink/5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-ink/10 flex items-center justify-center font-bold text-ink">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">{s.name}</div>
                    <div className="text-[11px] text-ink-500">{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancellation & Payment Policy Banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-start gap-3 text-xs text-emerald-950">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Compliant & Safe Service Checkout</div>
            <p className="text-emerald-900 leading-relaxed">
              Appointments are secured using direct Mobile Money or settled on-site.
              {business?.cancellation_policy && ` ${business.cancellation_policy}.`}
            </p>
          </div>
        </div>
      </main>

      {/* BOOKING MODAL */}
      {bookingModalOpen && selectedOffering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-surface-primary p-6 space-y-4 shadow-2xl border border-ink/10 my-8">
            <div className="flex items-center justify-between border-b border-ink/10 pb-3">
              <div>
                <h3 className="text-base font-black text-ink">
                  {bookingSuccess ? "Booking Confirmed!" : `Book ${selectedOffering.title}`}
                </h3>
                <p className="text-xs text-ink-500">
                  {selectedOffering.duration_minutes} mins ·{" "}
                  {selectedOffering.pricing_type === "custom_quote" ? "Custom Quote" : ugx(selectedOffering.price_ugx)}
                </p>
              </div>
              <button
                onClick={() => {
                  setBookingModalOpen(false);
                  setBookingSuccess(null);
                }}
                className="text-ink-400 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-ink">Your Appointment is Scheduled</h4>
                  <p className="text-xs text-ink-600">Reference: <strong>{bookingSuccess.id}</strong></p>
                  <p className="text-xs text-ink-500 mt-2">{bookingSuccess.instructions}</p>
                </div>

                <div className="p-4 rounded-2xl bg-cream border border-ink/5 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-ink-400">Scheduled Date:</span>
                    <span className="font-bold text-ink">{bookingSuccess.scheduled_date} at {bookingSuccess.scheduled_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Service Fee:</span>
                    <span className="font-bold text-ink">{ugx(bookingSuccess.total_price_ugx)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Payment Rail:</span>
                    <span className="font-bold text-ink capitalize">{bookingSuccess.payment_rail?.replace("_", " ")}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBookingModalOpen(false);
                    setBookingSuccess(null);
                  }}
                  className="w-full rounded-2xl bg-gold py-3 text-xs font-black text-black shadow hover:bg-gold-light"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleBookService} className="space-y-4 text-xs">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-ink">Choose Date *</label>
                    <div className="field-box rounded-xl">
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split("T")[0]}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full p-2.5 text-xs text-ink outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-ink">Preferred Time *</label>
                    <div className="field-box rounded-xl">
                      <select
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full p-2.5 text-xs text-ink outline-none bg-transparent"
                      >
                        <option value="09:00">09:00 AM</option>
                        <option value="10:30">10:30 AM</option>
                        <option value="11:30">11:30 AM</option>
                        <option value="14:00">02:00 PM</option>
                        <option value="15:30">03:30 PM</option>
                        <option value="17:00">05:00 PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-ink">Your Full Name *</label>
                    <div className="field-box rounded-xl">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Juliet Nabwire"
                        className="w-full p-2.5 text-xs text-ink outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-ink">Your Phone Number *</label>
                    <div className="field-box rounded-xl">
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+256 700 000 000"
                        className="w-full p-2.5 text-xs text-ink outline-none"
                      />
                    </div>
                  </div>
                </div>

                {selectedOffering.location_type === "client_site" && (
                  <div className="space-y-1">
                    <label className="font-bold text-ink">Your Physical Address / Site Location *</label>
                    <div className="field-box rounded-xl">
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. Plot 12, Muyenga Tank Hill Road"
                        className="w-full p-2.5 text-xs text-ink outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-ink">Specific Notes / Service Details</label>
                  <div className="field-box rounded-xl">
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Share any special instructions for the team..."
                      className="w-full p-2.5 text-xs text-ink outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Compliant Payment Rail Selection */}
                <div className="space-y-2 pt-2 border-t border-ink/5">
                  <label className="font-bold text-ink">Select Payment Method (Compliant Services Rails)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(!business?.allowed_payment_rails || business.allowed_payment_rails.includes("momo_mtn")) && (
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          paymentRail === "momo_mtn" ? "border-gold bg-gold/10" : "border-ink/10 bg-cream/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rail"
                          value="momo_mtn"
                          checked={paymentRail === "momo_mtn"}
                          onChange={() => setPaymentRail("momo_mtn")}
                          className="text-gold"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-ink">MTN Mobile Money</div>
                          <div className="text-[10px] text-ink-500">Push PIN prompt to phone</div>
                        </div>
                      </label>
                    )}

                    {(!business?.allowed_payment_rails || business.allowed_payment_rails.includes("momo_airtel")) && (
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          paymentRail === "momo_airtel" ? "border-gold bg-gold/10" : "border-ink/10 bg-cream/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rail"
                          value="momo_airtel"
                          checked={paymentRail === "momo_airtel"}
                          onChange={() => setPaymentRail("momo_airtel")}
                          className="text-gold"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-ink">Airtel Money</div>
                          <div className="text-[10px] text-ink-500">Push PIN prompt to phone</div>
                        </div>
                      </label>
                    )}

                    {(!business?.allowed_payment_rails || business.allowed_payment_rails.includes("cash_at_venue")) && (
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          paymentRail === "cash_at_venue" ? "border-gold bg-gold/10" : "border-ink/10 bg-cream/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rail"
                          value="cash_at_venue"
                          checked={paymentRail === "cash_at_venue"}
                          onChange={() => setPaymentRail("cash_at_venue")}
                          className="text-gold"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-ink">Pay on Service Completion</div>
                          <div className="text-[10px] text-ink-500">Settle directly upon delivery</div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink/10">
                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(false)}
                    className="rounded-xl px-4 py-2 font-bold text-ink-500 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBooking}
                    className="rounded-xl bg-gold px-6 py-2.5 font-black text-black shadow hover:bg-gold-light disabled:opacity-50"
                  >
                    {submittingBooking ? "Confirming..." : "Confirm Booking"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
