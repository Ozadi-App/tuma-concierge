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
