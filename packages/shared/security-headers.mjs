/**
 * Response headers shared by the customer, rider and admin apps.
 *
 * Plain .mjs on purpose: this is imported by each app's next.config.ts at
 * build time, before any TypeScript or bundler transform is available.
 *
 * The Content-Security-Policy here still allows inline scripts, because
 * Next.js emits them for hydration and locking that down properly needs
 * per-request nonces from middleware. What it does buy, today, is control
 * over *where* content may come from: a script tag injected by an attacker
 * pointing at their own domain won't load, and neither will a fetch that
 * tries to post stolen data somewhere off this list. Tightening script-src
 * with nonces is the next step, not a reason to skip the rest.
 */

/** Everything the three apps legitimately talk to. */
const GOOGLE_SIGNIN = "https://accounts.google.com";
const GOOGLE_AVATARS = "https://lh3.googleusercontent.com";
const OSM_TILES = "https://*.tile.openstreetmap.org https://tile.openstreetmap.org";
const OSM_GEOCODER = "https://nominatim.openstreetmap.org";
/** In-app navigation's driving route (apps/{rider,customer}/lib/navTiles.ts). */
const OSRM_ROUTER = "https://router.project-osrm.org";

/**
 * The admin-selectable map providers (apps/api/src/maps/credentials.ts).
 * Every one of them has to be allowed here up front — the admin can switch
 * providers at any time without a redeploy, and a provider missing from
 * this list fails in the browser as "Couldn't load <provider>".
 */
const MAPBOX = ["https://api.mapbox.com", "https://events.mapbox.com"];
const GOOGLE_MAPS_SCRIPTS = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
const GOOGLE_MAPS_DATA = ["https://*.googleapis.com", "https://*.gstatic.com", "https://*.google.com"];
const TILE_PROVIDERS = [
  "https://api.maptiler.com",
  "https://tiles.stadiamaps.com",
  "https://*.tile.thunderforest.com",
  // A CSP "*." wildcard needs at least one subdomain label, and Jawg serves
  // tiles from the bare tile.jawg.io — without it every Jawg tile is blocked
  // and the map renders as a grey box.
  "https://*.tile.jawg.io",
  "https://tile.jawg.io",
  "https://api.tomtom.com",
];

/**
 * Creator video (apps/api/src/video). Playlists and segments are fetched by script (hls.js), and
 * uploads go straight from the device to the provider, so these hosts need connect-src. Every provider
 * an admin can switch on has to be listed here up front, for the same reason as the map providers.
 * Pictures and playback of plain files (an .mp4, an ad) may come from any https host: neither can run
 * code, and creators and advertisers bring their own addresses.
 */
const VIDEO_PROVIDERS = [
  "https://*.cloudflarestream.com", "https://videodelivery.net", "https://upload.videodelivery.net",
  "https://stream.mux.com", "https://*.mux.com", "https://storage.googleapis.com",
  "https://res.cloudinary.com", "https://api.cloudinary.com",
  "https://video.bunnycdn.com", "https://*.b-cdn.net",
];

/**
 * @param {object} [options]
 * @param {string} [options.apiUrl] Origin of the Peebee API (NEXT_PUBLIC_API_URL).
 * @param {boolean} [options.dev] Relax the policy for `next dev`.
 * @param {boolean} [options.adPixels] Allow the Meta and TikTok pixel scripts. Only the public web storefront turns
 *   this on, because a merchant may connect their own pixel there; the signed-in apps never need it.
 */
export function buildSecurityHeaders({ apiUrl = "", dev = false, adPixels = false } = {}) {
  const api = apiUrl.trim().replace(/\/$/, "");
  const connect = ["'self'", api, OSM_GEOCODER, OSRM_ROUTER, GOOGLE_SIGNIN, ...MAPBOX, ...GOOGLE_MAPS_DATA, ...VIDEO_PROVIDERS].filter(Boolean);
  // `next dev` talks to its hot-reload server over a websocket.
  if (dev) connect.push("ws://localhost:*", "ws://127.0.0.1:*");

  const pixelScripts = adPixels ? " https://connect.facebook.net https://analytics.tiktok.com" : "";
  const pixelConnect = adPixels ? " https://www.facebook.com https://analytics.tiktok.com https://*.tiktok.com" : "";
  const pixelImg = adPixels ? " https://www.facebook.com https://analytics.tiktok.com https://*.tiktok.com" : "";

  const csp = [
    "default-src 'self'",
    // Blocks <base href="https://attacker.example"> from re-pointing every
    // relative URL on the page.
    "base-uri 'self'",
    "object-src 'none'",
    // The modern, harder-to-bypass counterpart to X-Frame-Options: nothing
    // may put these pages in a frame, so a transparent overlay can't trick
    // someone into clicking "Settle" or "Suspend".
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${GOOGLE_SIGNIN} ${MAPBOX[0]} ${GOOGLE_MAPS_SCRIPTS.join(" ")}${pixelScripts}`,
    // Sign in with Google pulls its button stylesheet from accounts.google.com
    // — leave it out and the button renders unstyled.
    // Mapbox GL and Google Maps load their own stylesheets/web fonts too.
    `style-src 'self' 'unsafe-inline' ${GOOGLE_SIGNIN} ${MAPBOX[0]} https://fonts.googleapis.com`,
    // The API's own origin serves the Learn thumbnails and uploaded cover pictures.
    `img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com ${OSM_TILES} https://*.openstreetmap.org ${GOOGLE_AVATARS} ${TILE_PROVIDERS.join(" ")} ${MAPBOX[0]} ${GOOGLE_MAPS_DATA.join(" ")} ${VIDEO_PROVIDERS.join(" ")} https: ${api}${pixelImg}`.trim(),
    "font-src 'self' data: https://fonts.gstatic.com",
    `media-src 'self' blob: https: ${api}`.trim(),
    `connect-src ${connect.join(" ")}${pixelConnect}`,
    `frame-src ${GOOGLE_SIGNIN}`,
    // Service worker (the PWA) and any blob-backed worker.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    // Belt and braces alongside frame-ancestors, for anything that still
    // only understands the older header.
    { key: "X-Frame-Options", value: "DENY" },
    // Stops a browser second-guessing a Content-Type and running an upload
    // as script.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Don't leak the path someone was on (which can name an order or a
    // rider) to third-party sites they click through to.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Geolocation and microphone are used by the apps themselves — the rest
    // is switched off so an injected frame can't reach for them.
    {
      key: "Permissions-Policy",
      value: "geolocation=(self), microphone=(self), camera=(), payment=(), usb=(), interest-cohort=()",
    },
    // Two years, subdomains included: after the first visit the browser
    // refuses to speak plain HTTP to this host at all.
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  ];
}

/** Drop straight into a Next.js config's `headers()`. */
export function securityHeaderRules(options) {
  return [{ source: "/:path*", headers: buildSecurityHeaders(options) }];
}
