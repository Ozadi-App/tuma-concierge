/**
 * The option registry: every design fork in the store, digital-product, LMS and services modules.
 *
 * Policy: build all the options, ship the recommended one as the default, and let admin switch to the others.
 * Each entry is the single source for four things — the stored default, the validation of an admin change, what the
 * admin page renders, and which options are actually selectable right now.
 *
 * - `recommended` marks the default choice (shown with a badge in admin).
 * - `built: false` means the code for that option is not shipped yet; admin sees it but cannot select it, and the
 *   running code falls back to the first built option, so a half-built path can never be switched on.
 * - `requires` lists the migration an option needs. Migrations are applied by hand, so an option whose table or column is
 *   missing is shown as "migration pending" and cannot be chosen until the migration lands.
 *
 * Pure data and helpers only (no database access) so it can be imported anywhere, including settings defaults.
 */

export type OptionModule = "storefront" | "digital" | "lms" | "services" | "platform";

export type OptionRequirement = {
  tables?: string[];
  columns?: Array<[table: string, column: string]>;
  /** The migration file to apply, shown to admin. */
  migration?: string;
  /** Needs a real SMS provider (not the simulator) with its credentials set. */
  sms?: boolean;
};

export type OptionChoice = {
  value: string;
  label: string;
  hint?: string;
  recommended?: boolean;
  /** False until the code for this option ships. */
  built: boolean;
  requires?: OptionRequirement;
};

type Base = { key: string; module: OptionModule; label: string; description: string };

export type EnumSetting = Base & { kind: "enum"; options: OptionChoice[]; default: string };
export type MultiSetting = Base & { kind: "multi"; options: OptionChoice[]; default: string[]; min?: number };
export type IntSetting = Base & { kind: "int"; default: number; min: number; max: number; unit?: string };
export type BoolSetting = Base & { kind: "bool"; default: boolean };
export type ListSetting = Base & { kind: "list"; default: string[]; maxItems: number; itemPattern: string; itemHint: string };
export type SettingDef = EnumSetting | MultiSetting | IntSetting | BoolSetting | ListSetting;

export type OptionValue = string | string[] | number | boolean;

const opt = (value: string, label: string, built: boolean, extra: Partial<OptionChoice> = {}): OptionChoice => ({ value, label, built, ...extra });

const ROLES: OptionChoice[] = [
  opt("owner", "Owner", true),
  opt("manager", "Manager", true),
  opt("finance", "Finance", true),
  opt("cashier", "Cashier", true),
];

export const OPTION_SETTINGS: SettingDef[] = [
  // ------------------------------------------------------------------ Storefront
  {
    key: "storefront_checkout_mode", module: "storefront", kind: "enum", label: "Web storefront checkout",
    description: "How a shopper on [store].peebee.online completes an order.",
    default: "handoff_to_app",
    options: [
      opt("handoff_to_app", "Continue in the Peebee app", true, { recommended: true, hint: "The web store builds the bag and hands over to the app, where payment and tracking live." }),
      opt("inline_web_checkout", "Pay on the web storefront", false, { hint: "Phone sign-in and mobile-money payment without leaving the web store." }),
      opt("whatsapp_order", "Send the order on WhatsApp", true, { hint: "The bag is sent to the merchant on WhatsApp; they confirm and invoice." }),
    ],
  },
  {
    key: "storefront_domain_mode", module: "storefront", kind: "enum", label: "Store web addresses",
    description: "Which addresses a store can be reached on.",
    default: "subdomain_only",
    options: [
      opt("subdomain_only", "Peebee subdomain only", true, { recommended: true, hint: "[store].peebee.online" }),
      opt("subdomain_plus_verified_custom_domains", "Subdomain and verified custom domains", true, {
        hint: "Merchants can connect their own domain after proving they own it (DNS check).",
        requires: { columns: [["stores", "domain_verified"]], migration: "0135_storefront_hardening.sql" },
      }),
    ],
  },
  {
    key: "storefront_reserved_subdomains", module: "storefront", kind: "list", label: "Reserved store names",
    description: "Names no store may take as its web address (lookalikes of platform pages).",
    default: ["www", "app", "customer", "rider", "merchant", "admin", "api", "food", "gas", "pharmacy", "partner", "sales", "work", "learn", "tv", "preview", "login", "signin", "secure", "pay", "payment", "payments", "wallet", "support", "help", "mail", "email", "status", "docs", "blog", "cdn", "static", "assets", "auth", "account", "billing", "staging", "dev", "test", "peebee"],
    maxItems: 200, itemPattern: "^[a-z0-9-]{1,40}$", itemHint: "lowercase letters, numbers and hyphens",
  },
  {
    key: "storefront_promo_visibility", module: "storefront", kind: "enum", label: "Promo codes shown on the web store",
    description: "Which discounts are listed publicly. Private codes always work when typed in.",
    default: "automatic_only_public",
    options: [
      opt("automatic_only_public", "Automatic offers only", true, { recommended: true }),
      opt("flagged_public", "Automatic offers and codes the merchant marks public", true, { requires: { columns: [["store_discounts", "is_public"]], migration: "0135_storefront_hardening.sql" } }),
      opt("none_public", "Nothing listed", true),
    ],
  },
  {
    key: "storefront_b2b_inquiry_protection", module: "storefront", kind: "enum", label: "Wholesale inquiry protection",
    description: "How the public wholesale form is protected from spam.",
    default: "phone_otp",
    options: [
      opt("rate_limit_only", "Rate limit", true),
      opt("phone_otp", "Rate limit and phone code", true, { recommended: true, requires: { sms: true } }),
      opt("captcha", "Rate limit and captcha", false, { hint: "Needs a captcha account (e.g. Cloudflare Turnstile) to be connected first." }),
    ],
  },
  {
    key: "storefront_render_mode", module: "storefront", kind: "enum", label: "Storefront rendering",
    description: "Server-rendered pages give search engines and link previews real content.",
    default: "server_rendered_seo",
    options: [
      opt("server_rendered_seo", "Server-rendered with SEO tags", true, { recommended: true }),
      opt("client_only", "Browser-rendered only", true),
    ],
  },
  {
    key: "storefront_stale_status_behavior", module: "storefront", kind: "enum", label: "Paused or suspended stores",
    description: "What visitors see at the address of a store that is not live.",
    default: "show_suspended_page",
    options: [
      opt("show_suspended_page", "A friendly 'store unavailable' page", true, { recommended: true }),
      opt("not_found", "Not found (404)", true),
    ],
  },
  {
    key: "loyalty_credit_trigger", module: "storefront", kind: "enum", label: "When loyalty cashback is credited",
    description: "Cashback is only credited once the chosen event happens, and reversed on a refund.",
    default: "on_delivery_or_paid",
    options: [
      opt("on_delivery_or_paid", "Once the order is delivered and settled", true, { recommended: true, requires: { tables: ["store_loyalty_events"], migration: "0135_storefront_hardening.sql" } }),
      opt("on_payment_confirmed", "Once payment is confirmed", true, { requires: { tables: ["store_loyalty_events"], migration: "0135_storefront_hardening.sql" } }),
      opt("on_order_placed", "As soon as the order is placed", true, { hint: "The previous behaviour. Not recommended: cancelled orders keep the points." }),
    ],
  },
  {
    key: "storefront_pixels_enabled", module: "storefront", kind: "bool", label: "Ad pixels on storefronts",
    description: "Allow merchants' Meta and TikTok pixel IDs to be loaded on their web store.", default: true,
  },

  // ------------------------------------------------------------------ Digital products
  {
    key: "digital_storage_backend", module: "digital", kind: "enum", label: "Where digital files are stored",
    description: "Files are only ever reached through a purchase token, never a public link.",
    default: "r2_private_signed",
    options: [
      opt("r2_private_signed", "Private storage with short-lived links", false, { recommended: true }),
      opt("worker_stream_proxy", "Streamed through Peebee", false),
      opt("external_url_via_redirect", "Merchant-hosted file behind the token", true, { hint: "The previous behaviour: the token gates a redirect to the merchant's own URL." }),
    ],
  },
  {
    key: "digital_delivery_channels", module: "digital", kind: "multi", label: "How buyers receive digital goods",
    description: "Channels used after a successful purchase.",
    default: ["on_screen", "sms_link"], min: 1,
    options: [
      opt("on_screen", "On the confirmation screen", true, { recommended: true }),
      opt("sms_link", "SMS with a one-tap link", false, { recommended: true }),
      opt("whatsapp_link", "WhatsApp message", false),
      opt("email_link", "Email", false),
    ],
  },
  { key: "digital_default_max_downloads", module: "digital", kind: "int", label: "Default download limit", description: "Downloads per purchase when the merchant does not set one. 0 means unlimited.", default: 5, min: 0, max: 1000 },
  { key: "digital_default_expiry_days", module: "digital", kind: "int", label: "Default link lifetime", description: "Days a purchase link works. 0 means it never expires.", default: 30, min: 0, max: 3650, unit: "days" },
  {
    key: "digital_license_exhausted_action", module: "digital", kind: "enum", label: "When licence keys run out",
    description: "What happens to a sale when the key pool is empty.",
    default: "block_sale",
    options: [
      opt("block_sale", "Stop the sale", false, { recommended: true }),
      opt("allow_backorder_manual_fulfil", "Take the order and let the merchant fulfil it", false),
      opt("auto_hide_product", "Hide the product", false),
    ],
  },
  {
    key: "digital_license_reveal", module: "digital", kind: "enum", label: "Where a licence key is shown",
    description: "Keys are secrets; choose how they reach the buyer.",
    default: "after_phone_check",
    options: [
      opt("after_phone_check", "On the download page after the buyer confirms their phone", false, { recommended: true }),
      opt("on_token_page", "On the download page for anyone with the link", true),
      opt("sms_only", "By SMS only", false),
    ],
  },
  { key: "digital_refund_revokes_access", module: "digital", kind: "bool", label: "Refunds revoke access", description: "A refunded purchase stops working immediately.", default: true },
  { key: "digital_max_products", module: "digital", kind: "int", label: "Digital products per store", description: "Upper limit per store.", default: 200, min: 1, max: 5000 },
  {
    key: "digital_file_scan", module: "digital", kind: "enum", label: "Uploaded file checks",
    description: "What is checked when a merchant adds a file.",
    default: "size_and_mime_check",
    options: [
      opt("size_and_mime_check", "Size and file type", false, { recommended: true }),
      opt("size_mime_and_scan_hook", "Size, type and a malware scan", false),
      opt("off", "No checks", true),
    ],
  },

  // ------------------------------------------------------------------ LMS / Peebee Learn
  {
    key: "lms_learn_sync_mode", module: "lms", kind: "enum", label: "Peebee Learn listing",
    description: "How a store's courses appear in the Peebee Learn catalogue.",
    default: "two_way_auto",
    options: [
      opt("two_way_auto", "Automatic two-way sync", true, { recommended: true }),
      opt("publish_to_learn_manual", "Merchant publishes to Learn manually", false),
      opt("store_only", "Store only, not listed in Learn", false),
    ],
  },
  {
    key: "lms_enrollment_identity", module: "lms", kind: "enum", label: "Student accounts",
    description: "How a student gets an account when a merchant enrols them or they buy a course.",
    default: "phone_account_auto_create_sms_setup",
    options: [
      opt("phone_account_auto_create_sms_setup", "Create the account from their phone and send a setup link", false, { recommended: true }),
      opt("require_existing_account", "They must already have a Peebee account", false),
      opt("email_invite", "Invite them by email", false),
    ],
  },
  {
    key: "lms_payment_path", module: "lms", kind: "enum", label: "How course sales are paid",
    description: "Which payment path course purchases use.",
    default: "learn_payments_commission",
    options: [
      opt("learn_payments_commission", "Peebee Learn payments (Learn commission)", false, { recommended: true }),
      opt("store_checkout_direct", "Store checkout", false),
    ],
  },
  {
    key: "lms_content_protection", module: "lms", kind: "enum", label: "Lesson content protection",
    description: "How lesson videos and files are protected from sharing.",
    default: "signed_urls",
    options: [
      opt("signed_urls", "Short-lived signed links", false, { recommended: true }),
      opt("domain_allowlist_only", "Only approved video hosts", false),
      opt("none", "No protection (free courses)", true),
    ],
  },
  {
    key: "lms_certificates", module: "lms", kind: "enum", label: "Certificates",
    description: "When a certificate is issued.",
    default: "auto_on_completion",
    options: [
      opt("auto_on_completion", "Automatically on completion", false, { recommended: true }),
      opt("manual_issue", "Merchant issues them", false),
      opt("off", "Off", false),
    ],
  },
  { key: "lms_pass_mark_percent", module: "lms", kind: "int", label: "Quiz pass mark", description: "Score needed to pass a quiz.", default: 70, min: 0, max: 100, unit: "%" },
  {
    key: "lms_drip_default", module: "lms", kind: "enum", label: "Default lesson release",
    description: "When lessons unlock for a new course.",
    default: "all_at_once",
    options: [opt("all_at_once", "All at once", true, { recommended: true }), opt("weekly", "One module a week", false), opt("custom", "Merchant sets a schedule", false)],
  },
  { key: "lms_max_courses", module: "lms", kind: "int", label: "Courses per store", description: "Upper limit per store.", default: 50, min: 1, max: 1000 },

  // ------------------------------------------------------------------ Services
  {
    key: "services_online_collection_mode", module: "services", kind: "enum", label: "How online service payments are collected",
    description: "Service money moves on mobile money, cash and bank rails only — never cards.",
    default: "momo_escrow",
    options: [
      opt("momo_escrow", "Mobile money held until the service is done", false, { recommended: true }),
      opt("momo_direct", "Mobile money straight to the provider", false),
      opt("deposit_online_balance_at_venue", "Deposit online, balance at the venue", false),
      opt("pay_at_venue_only", "Pay at the venue only", true, { hint: "No online collection. Bookings are never marked paid by the customer." }),
    ],
  },
  {
    key: "services_enabled_rails", module: "services", kind: "multi", label: "Payment methods for services",
    description: "Platform-wide methods a business may offer. Cards are not available for services.",
    default: ["momo_mtn", "momo_airtel", "cash_at_venue"], min: 1,
    options: [
      opt("momo_mtn", "MTN Mobile Money", true, { recommended: true }),
      opt("momo_airtel", "Airtel Money", true, { recommended: true }),
      opt("cash_at_venue", "Cash at the venue", true, { recommended: true }),
      opt("bank_wire", "Bank transfer", true),
    ],
  },
  {
    key: "services_booking_confirmation", module: "services", kind: "enum", label: "Confirming bookings",
    description: "Who confirms a customer's booking request.",
    default: "provider_confirms",
    options: [
      opt("provider_confirms", "The provider confirms each booking", true, { recommended: true }),
      opt("auto_confirm", "Confirm automatically", true),
      opt("auto_confirm_when_paid", "Confirm automatically once paid", false),
    ],
  },
  {
    key: "services_cancellation_refund_mode", module: "services", kind: "enum", label: "Cancellations and refunds",
    description: "How refunds are decided when a customer cancels.",
    default: "policy_based",
    options: [
      opt("policy_based", "Follow the business's cancellation policy", false, { recommended: true }),
      opt("full_refund_until_x_hours", "Full refund until the window below", false),
      opt("no_refund", "No refunds", false),
      opt("manual_review", "Provider decides each time", false),
    ],
  },
  { key: "services_cancellation_window_hours", module: "services", kind: "int", label: "Free-cancellation window", description: "Hours before the appointment a customer may cancel for a full refund.", default: 24, min: 0, max: 720, unit: "hours" },
  {
    key: "services_business_approval", module: "services", kind: "enum", label: "Approving new service businesses",
    description: "Whether a new service business goes live straight away.",
    default: "admin_review",
    options: [
      opt("admin_review", "Admin reviews each new business", true, { recommended: true }),
      opt("auto_approve_verified_users", "Live at once for verified accounts", true),
      opt("auto_approve_all", "Live at once for everyone", true),
    ],
  },
  {
    key: "services_booking_verification", module: "services", kind: "enum", label: "Checking public bookings",
    description: "How a public booking request is checked before it is accepted.",
    default: "phone_otp",
    options: [
      opt("phone_otp", "Rate limit and phone code", true, { recommended: true, requires: { sms: true } }),
      opt("rate_limit_only", "Rate limit only", true),
      opt("none", "No checks", true),
    ],
  },
  {
    key: "services_availability_mode", module: "services", kind: "enum", label: "Choosing a time",
    description: "How customers pick when they want the service.",
    default: "free_text_request",
    options: [
      opt("weekly_schedule_with_slots", "Pick from the provider's open slots", false, { recommended: true, requires: { tables: ["service_availability"], migration: "0136_services_hardening.sql" } }),
      opt("free_text_request", "Request a date and time, the provider confirms", true),
    ],
  },

  // ------------------------------------------------------------------ Cross-cutting
  { key: "rate_limit_public_booking_per_hour", module: "platform", kind: "int", label: "Public bookings per person per hour", description: "Per phone and per network address.", default: 10, min: 1, max: 1000 },
  { key: "rate_limit_public_inquiry_per_hour", module: "platform", kind: "int", label: "Wholesale inquiries per person per hour", description: "Per phone and per network address.", default: 5, min: 1, max: 1000 },
  { key: "rate_limit_token_download_per_minute", module: "platform", kind: "int", label: "Download link requests per minute", description: "Per link and per network address.", default: 20, min: 1, max: 1000 },
  { key: "member_roles_manage_catalog", module: "platform", kind: "multi", label: "Who can change products and prices", description: "Merchant team roles.", default: ["owner", "manager"], min: 1, options: ROLES },
  { key: "member_roles_manage_store_settings", module: "platform", kind: "multi", label: "Who can change store settings and domain", description: "Merchant team roles.", default: ["owner", "manager"], min: 1, options: ROLES },
  { key: "member_roles_manage_digital", module: "platform", kind: "multi", label: "Who can manage digital products and courses", description: "Merchant team roles.", default: ["owner", "manager"], min: 1, options: ROLES },
  { key: "member_roles_refund_revoke", module: "platform", kind: "multi", label: "Who can revoke access and refund", description: "Merchant team roles.", default: ["owner", "manager", "finance"], min: 1, options: ROLES },
  { key: "member_roles_manage_billing", module: "platform", kind: "multi", label: "Who can change the store plan", description: "Merchant team roles.", default: ["owner"], min: 1, options: ROLES },
  {
    key: "marketplace_demo_catalog", module: "platform", kind: "enum", label: "Demo stores and products",
    description: "Where the built-in demo catalogue may be ordered from. Practice mode never uses this; it runs in the app.",
    default: "sandbox_only",
    options: [
      opt("sandbox_only", "Only while the platform is in sandbox", true, { recommended: true }),
      opt("always", "Always", true),
    ],
  },
];

const BY_KEY = new Map(OPTION_SETTINGS.map((def) => [def.key, def]));

export function getSettingDef(key: string): SettingDef | undefined {
  return BY_KEY.get(key);
}

/** Stored (string) form of a value. */
export function encodeValue(def: SettingDef, value: OptionValue): string {
  if (def.kind === "bool") return value ? "1" : "0";
  if (def.kind === "int") return String(Math.round(Number(value)));
  if (def.kind === "multi" || def.kind === "list") return JSON.stringify(value);
  return String(value);
}

/** Defaults in stored form, merged into the platform settings defaults. */
export const OPTION_DEFAULTS: Record<string, string> = Object.fromEntries(
  OPTION_SETTINGS.map((def) => [def.key, encodeValue(def, def.default)]),
);

/** Read a stored string back into a typed value; anything malformed falls back to the default. */
export function decodeValue(def: SettingDef, raw: string | undefined | null): OptionValue {
  if (raw == null || raw === "") return def.default;
  try {
    switch (def.kind) {
      case "bool":
        return raw !== "0";
      case "int": {
        const n = Number(raw);
        return Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, Math.round(n))) : def.default;
      }
      case "multi":
      case "list": {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every((v) => typeof v === "string") ? parsed : def.default;
      }
      default:
        return raw;
    }
  } catch {
    return def.default;
  }
}

export type Availability = { available: boolean; reason?: "not_built" | "migration_pending" | "sms_provider_pending" };
/** Which database objects exist right now; supplied by the caller (see option-settings.ts). */
export type SchemaProbe = { hasTable(name: string): boolean; hasColumn(table: string, column: string): boolean; smsReady?(): boolean };

export function choiceAvailability(choice: OptionChoice, schema: SchemaProbe): Availability {
  if (!choice.built) return { available: false, reason: "not_built" };
  const need = choice.requires;
  if (need?.tables?.some((t) => !schema.hasTable(t))) return { available: false, reason: "migration_pending" };
  if (need?.columns?.some(([t, c]) => !schema.hasColumn(t, c))) return { available: false, reason: "migration_pending" };
  if (need?.sms && !schema.smsReady?.()) return { available: false, reason: "sms_provider_pending" };
  return { available: true };
}

/**
 * The value the running code should act on. A stored choice that is not selectable (never built, or its migration is
 * missing) is replaced by the first selectable option, so the platform keeps working while an option is unavailable.
 */
export function resolveEffective(def: SettingDef, stored: OptionValue, schema: SchemaProbe): OptionValue {
  if (def.kind === "enum") {
    const chosen = def.options.find((o) => o.value === stored);
    if (chosen && choiceAvailability(chosen, schema).available) return chosen.value;
    return def.options.find((o) => choiceAvailability(o, schema).available)?.value ?? def.default;
  }
  if (def.kind === "multi") {
    const list = (Array.isArray(stored) ? stored : []).filter((v) => {
      const choice = def.options.find((o) => o.value === v);
      return choice && choiceAvailability(choice, schema).available;
    });
    if (list.length >= (def.min ?? 0) && list.length > 0) return list;
    const fallback = def.options.filter((o) => choiceAvailability(o, schema).available && (def.default as string[]).includes(o.value)).map((o) => o.value);
    return fallback.length ? fallback : def.options.filter((o) => choiceAvailability(o, schema).available).slice(0, 1).map((o) => o.value);
  }
  return stored;
}

export type ValidationResult = { ok: true; value: OptionValue } | { ok: false; message: string };

/** Validate an admin-supplied value for a setting. Unavailable options are refused, not silently stored. */
export function validateValue(def: SettingDef, input: unknown, schema: SchemaProbe): ValidationResult {
  switch (def.kind) {
    case "bool":
      return typeof input === "boolean" ? { ok: true, value: input } : { ok: false, message: `${def.label}: expected on or off.` };
    case "int":
      if (typeof input !== "number" || !Number.isFinite(input) || !Number.isInteger(input)) return { ok: false, message: `${def.label}: expected a whole number.` };
      if (input < def.min || input > def.max) return { ok: false, message: `${def.label}: must be between ${def.min} and ${def.max}.` };
      return { ok: true, value: input };
    case "enum": {
      const choice = def.options.find((o) => o.value === input);
      if (!choice) return { ok: false, message: `${def.label}: unknown option.` };
      const a = choiceAvailability(choice, schema);
      if (!a.available) return { ok: false, message: `${def.label}: "${choice.label}" is ${a.reason === "not_built" ? "not available yet" : a.reason === "sms_provider_pending" ? "waiting for a real SMS provider (Admin → Marketplace → SMS provider, with its credentials set)" : `waiting for migration ${choice.requires?.migration ?? ""}`}.` };
      return { ok: true, value: choice.value };
    }
    case "multi": {
      if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) return { ok: false, message: `${def.label}: expected a list.` };
      const unique = [...new Set(input as string[])];
      if (unique.length < (def.min ?? 0)) return { ok: false, message: `${def.label}: choose at least ${def.min}.` };
      for (const value of unique) {
        const choice = def.options.find((o) => o.value === value);
        if (!choice) return { ok: false, message: `${def.label}: unknown option "${value}".` };
        const a = choiceAvailability(choice, schema);
        if (!a.available) return { ok: false, message: `${def.label}: "${choice.label}" is not available yet.` };
      }
      return { ok: true, value: unique };
    }
    case "list": {
      if (!Array.isArray(input) || input.some((v) => typeof v !== "string")) return { ok: false, message: `${def.label}: expected a list.` };
      const pattern = new RegExp(def.itemPattern);
      const cleaned = [...new Set((input as string[]).map((v) => v.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length > def.maxItems) return { ok: false, message: `${def.label}: at most ${def.maxItems} entries.` };
      const bad = cleaned.find((v) => !pattern.test(v));
      if (bad) return { ok: false, message: `${def.label}: "${bad}" is not valid — use ${def.itemHint}.` };
      return { ok: true, value: cleaned };
    }
  }
}
