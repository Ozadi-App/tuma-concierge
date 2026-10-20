import L from "leaflet";

/** "You are here": the app's gold, ringed in cream. */
export const meIcon = L.divIcon({
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#C9A227;border:3px solid #FDFBF7;box-shadow:0 0 0 6px rgba(201,162,39,0.25),0 2px 6px rgba(10,10,10,0.35)"></span>`,
  className: "peebee-me-dot",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Pickup: a solid ink dot with a cream ring. */
export const pickupIcon = L.divIcon({
  html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#0A0A0A;border:4px solid #FDFBF7;box-shadow:0 2px 8px rgba(10,10,10,0.45)"></span>`,
  className: "peebee-marker",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Destination: the gold teardrop used by the location pickers. */
export const destinationIcon = L.divIcon({
  html: `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s7-7.94 7-12.75A7 7 0 0 0 5 9.25C5 14.06 12 22 12 22Z" fill="#C9A227" stroke="#0A0A0A" stroke-width="1.1"/>
    <circle cx="12" cy="9.4" r="2.6" fill="#FDFBF7"/>
  </svg>`,
  className: "peebee-marker",
  iconSize: [38, 38],
  iconAnchor: [19, 36],
});

/** A numbered stop on a multi-stop ride: a small black disc with a gold number. */
export function stopIcon(n: number, done = false) {
  return L.divIcon({
    html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:${done ? "#2FA86A" : "#0A0A0A"};color:${done ? "#fff" : "#E8C55A"};font:700 13px/1 system-ui,sans-serif;border:2px solid #FDFBF7;box-shadow:0 2px 6px rgba(0,0,0,.35)">${done ? "✓" : n}</span>`,
    className: "peebee-marker",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export type TradePin = { type: "clean" | "laundry" | "fix"; lat: number; lng: number };

const TRADE_GLYPH: Record<TradePin["type"], string> = {
  // Sparkle, washing machine and wrench, drawn small so they read at a glance.
  clean: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" fill="currentColor"/>',
  laundry: '<rect x="6" y="5" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  fix: '<path d="M14.5 5.5a3.5 3.5 0 0 0-4.3 4.3L5.5 14.5l2 2 4.7-4.7a3.5 3.5 0 0 0 4.3-4.3l-2 2-2-2z" fill="currentColor"/>',
};
const TRADE_STYLE: Record<TradePin["type"], [bg: string, fg: string]> = {
  clean: ["#C9A227", "#0A0A0A"],
  laundry: ["#FDFBF7", "#9A7A12"],
  fix: ["#0A0A0A", "#E8C55A"],
};
const tradeIcons = new Map<string, L.DivIcon>();
/** A Hive provider pin: a disc in the trade's colour. Pins sit on a coarse grid, never on a person. */
export function tradePinIcon(type: TradePin["type"]) {
  const cached = tradeIcons.get(type);
  if (cached) return cached;
  const [bg, fg] = TRADE_STYLE[type];
  const icon = L.divIcon({
    html: `<span class="hive-pin hive-pin--${type}" style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:9999px;background:${bg};color:${fg};border:2px solid ${type === "laundry" ? "#C9A227" : "#FDFBF7"};box-shadow:0 2px 8px rgba(10,10,10,.35)"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">${TRADE_GLYPH[type]}</svg></span>`,
    className: "peebee-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  tradeIcons.set(type, icon);
  return icon;
}
