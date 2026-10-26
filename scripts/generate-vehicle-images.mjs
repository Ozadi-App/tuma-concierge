import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const VEHICLES = [
  {
    id: "toyota-wish-2013",
    make: "Toyota",
    model: "Wish",
    modelYear: "2013 Model",
    plate: "UBM 314A",
    body: "mpv",
    isVip: false,
    townRate: "120,000",
    upcountryRate: "180,000",
    color: "#2563EB",
    colorDark: "#1D4ED8",
    colorLight: "#60A5FA",
    accent: "#93C5FD",
    headline: "Toyota Wish · 2013",
    subtitle: "7 Seater Family MPV",
  },
  {
    id: "toyota-noah-2013",
    make: "Toyota",
    model: "Noah",
    modelYear: "2013 Model",
    plate: "UBP 520B",
    body: "box_mpv",
    isVip: false,
    townRate: "150,000",
    upcountryRate: "200,000",
    color: "#475569",
    colorDark: "#334155",
    colorLight: "#94A3B8",
    accent: "#CBD5E1",
    headline: "Toyota Noah · 2013",
    subtitle: "8 Seater Passenger Van",
  },
  {
    id: "toyota-land-cruiser-tx-kaweesi",
    make: "Toyota",
    model: "Land Cruiser TX (Kaweesi)",
    modelYear: "2016 Model and above",
    plate: "UBA 777K",
    body: "large_suv",
    isVip: true,
    townRate: "450,000",
    upcountryRate: "500,000",
    color: "#0F172A",
    colorDark: "#020617",
    colorLight: "#334155",
    accent: "#EAB308",
    headline: "Toyota Land Cruiser TX Kaweesi",
    subtitle: "7 Seater Executive 4WD SUV",
  },
  {
    id: "toyota-prado-ronaldo-2008",
    make: "Toyota",
    model: "Land Cruiser Prado (Ronaldo)",
    modelYear: "2008 Model",
    plate: "UBK 404R",
    body: "large_suv",
    isVip: false,
    townRate: "300,000",
    upcountryRate: "350,000",
    color: "#64748B",
    colorDark: "#475569",
    colorLight: "#94A3B8",
    accent: "#CBD5E1",
    headline: "Toyota Prado Ronaldo · 2008",
    subtitle: "7 Seater Rugged 4WD SUV",
  },
  {
    id: "subaru-impreza-2016",
    make: "Subaru",
    model: "Impreza",
    modelYear: "2016 Model",
    plate: "UBL 109S",
    body: "hatch",
    isVip: false,
    townRate: "150,000",
    upcountryRate: "200,000",
    color: "#1E40AF",
    colorDark: "#1E3A8A",
    colorLight: "#3B82F6",
    accent: "#93C5FD",
    headline: "Subaru Impreza · 2016",
    subtitle: "5 Seater All-Wheel Drive",
  },
  {
    id: "toyota-hiace-high-roof-15",
    make: "Toyota",
    model: "Hiace High Roof Commuter",
    modelYear: "15 Seater Commuter",
    plate: "UBQ 880H",
    body: "commuter_van",
    isVip: false,
    townRate: "300,000",
    upcountryRate: "350,000",
    color: "#E2E8F0",
    colorDark: "#94A3B8",
    colorLight: "#FFFFFF",
    accent: "#3B82F6",
    headline: "Toyota Hiace Commuter 15-Seater",
    subtitle: "High Roof Shuttle · Chauffeur Driven",
  },
  {
    id: "toyota-harrier-2014",
    make: "Toyota",
    model: "Harrier",
    modelYear: "2014 Model",
    plate: "UBH 612T",
    body: "crossover",
    isVip: false,
    townRate: "200,000",
    upcountryRate: "250,000",
    color: "#1E293B",
    colorDark: "#0F172A",
    colorLight: "#475569",
    accent: "#94A3B8",
    headline: "Toyota Harrier · 2014",
    subtitle: "5 Seater Premium Crossover SUV",
  },
  {
    id: "range-rover-velar-2018",
    make: "Range Rover",
    model: "Velar",
    modelYear: "2018 Model",
    plate: "UBV 001V",
    body: "luxury_suv",
    isVip: true,
    townRate: "1,000,000",
    upcountryRate: "1,500,000",
    color: "#18181B",
    colorDark: "#09090B",
    colorLight: "#3F3F46",
    accent: "#EAB308",
    headline: "Range Rover Velar · 2018",
    subtitle: "VIP Luxury Executive SUV",
  },
  {
    id: "range-rover-sport-2018",
    make: "Range Rover",
    model: "Sport",
    modelYear: "2018 Model",
    plate: "UBS 007R",
    body: "luxury_suv",
    isVip: true,
    townRate: "1,000,000",
    upcountryRate: "1,500,000",
    color: "#7F1D1D",
    colorDark: "#450A0A",
    colorLight: "#DC2626",
    accent: "#FDE047",
    headline: "Range Rover Sport · 2018",
    subtitle: "VIP Dynamic Performance SUV",
  },
  {
    id: "mercedes-benz-station-wagon-2024",
    make: "Mercedes-Benz",
    model: "Station Wagon",
    modelYear: "2024 Model",
    plate: "UBW 024M",
    body: "wagon",
    isVip: true,
    townRate: "1,700,000",
    upcountryRate: "2,500,000",
    color: "#334155",
    colorDark: "#1E293B",
    colorLight: "#64748B",
    accent: "#FACC15",
    headline: "Mercedes-Benz Station Wagon · 2024",
    subtitle: "VIP Luxury Estate Chauffeur",
  },
  {
    id: "mercedes-benz-g-wagon",
    make: "Mercedes-Benz",
    model: "G-Wagon",
    modelYear: "G 63 / AMG",
    plate: "UBG 001G",
    body: "gwagon",
    isVip: true,
    townRate: "2,000,000",
    upcountryRate: "2,500,000",
    color: "#18181B",
    colorDark: "#09090B",
    colorLight: "#27272A",
    accent: "#EAB308",
    headline: "Mercedes-Benz G-Wagon",
    subtitle: "VIP Executive Convoy & Red Carpet",
  },
  {
    id: "mercedes-benz-gle-coupe",
    make: "Mercedes-Benz",
    model: "GLE Coupe",
    modelYear: "Coupe SUV",
    plate: "UBX 999E",
    body: "coupe_suv",
    isVip: true,
    townRate: "1,200,000",
    upcountryRate: "1,800,000",
    color: "#581C87",
    colorDark: "#3B0764",
    colorLight: "#7E22CE",
    accent: "#FDE047",
    headline: "Mercedes-Benz GLE Coupe",
    subtitle: "VIP Athletic Luxury Coupe SUV",
  },
  {
    id: "porsche-panamera-2013",
    make: "Porsche",
    model: "Panamera",
    modelYear: "2013 Model",
    plate: "UBP 911P",
    body: "saloon_sport",
    isVip: true,
    townRate: "1,200,000",
    upcountryRate: "1,500,000",
    color: "#1E293B",
    colorDark: "#0F172A",
    colorLight: "#475569",
    accent: "#EAB308",
    headline: "Porsche Panamera · 2013",
    subtitle: "VIP Sports Grand Tourer Saloon",
  },
  {
    id: "toyota-alphard-hybrid",
    make: "Toyota",
    model: "Alphard Hybrid",
    modelYear: "Executive Lounge",
    plate: "UBA 600H",
    body: "luxury_van",
    isVip: true,
    townRate: "600,000",
    upcountryRate: "700,000",
    color: "#0F172A",
    colorDark: "#020617",
    colorLight: "#1E293B",
    accent: "#EAB308",
    headline: "Toyota Alphard Hybrid Lounge",
    subtitle: "VIP 7-Seater Executive Cabin",
  },
  {
    id: "mercedes-benz-v-class",
    make: "Mercedes-Benz",
    model: "V-Class",
    modelYear: "VIP Lounge",
    plate: "UBV 700M",
    body: "luxury_van",
    isVip: true,
    townRate: "700,000",
    upcountryRate: "900,000",
    color: "#18181B",
    colorDark: "#09090B",
    colorLight: "#3F3F46",
    accent: "#FACC15",
    headline: "Mercedes-Benz V-Class",
    subtitle: "VIP Executive Airport & Red Carpet",
  },
  {
    id: "safari-van-10-seater",
    make: "Toyota",
    model: "Safari Van",
    modelYear: "10 Seater Pop-up Roof",
    plate: "UBT 100S",
    body: "safari_van",
    isVip: false,
    townRate: "200,000",
    upcountryRate: "250,000",
    color: "#78716C",
    colorDark: "#57534E",
    colorLight: "#A8A29E",
    accent: "#F59E0B",
    headline: "Safari Van 10-Seater",
    subtitle: "4WD Tour Van with Pop-up Roof",
  },
  {
    id: "toyota-alphard-petrol",
    make: "Toyota",
    model: "Alphard",
    modelYear: "Petrol Standard",
    plate: "UBA 200T",
    body: "luxury_van",
    isVip: false,
    townRate: "200,000",
    upcountryRate: "250,000",
    color: "#E2E8F0",
    colorDark: "#94A3B8",
    colorLight: "#FFFFFF",
    accent: "#64748B",
    headline: "Toyota Alphard · Petrol",
    subtitle: "7 Seater Luxury Passenger Van",
  },
];

function generateSvg(v) {
  const vipBadge = v.isVip
    ? `
    <!-- VIP Crown Badge -->
    <g transform="translate(640, 24)">
      <rect x="0" y="0" width="136" height="34" rx="17" fill="#EAB308" fill-opacity="0.18" stroke="#EAB308" stroke-width="1.5" />
      <path d="M16 23L12 11L18 15L24 9L30 15L36 11L32 23Z" fill="#EAB308" />
      <text x="44" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#EAB308" letter-spacing="1">VIP FLEET</text>
    </g>`
    : `
    <!-- Standard Fleet Badge -->
    <g transform="translate(636, 24)">
      <rect x="0" y="0" width="140" height="34" rx="17" fill="#3B82F6" fill-opacity="0.12" stroke="#3B82F6" stroke-width="1.2" />
      <text x="70" y="22" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#60A5FA" letter-spacing="0.5">STANDARD FLEET</text>
    </g>`;

  // Body silhouette paths depending on body type
  let carBodySvg = "";
  if (v.body === "gwagon") {
    carBodySvg = `
      <!-- G-Wagon Boxy Silhouette -->
      <path d="M140 330 L160 210 L195 200 L240 130 L480 130 L640 145 L675 220 L685 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Roof Rack / Sunroof -->
      <rect x="250" y="122" width="220" height="8" rx="2" fill="#52525B" />
      <!-- Windows -->
      <path d="M255 142 L330 142 L330 205 L215 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#71717A" stroke-width="1.5" />
      <rect x="345" y="142" width="125" height="63" fill="#09090B" fill-opacity="0.85" stroke="#71717A" stroke-width="1.5" />
      <path d="M485 142 L615 152 L620 205 L485 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#71717A" stroke-width="1.5" />
      <!-- Spare Tire Mount on Rear -->
      <rect x="122" y="210" width="22" height="90" rx="11" fill="#27272A" stroke="#52525B" stroke-width="2" />
      <!-- Side Trim Strip -->
      <line x1="150" y1="260" x2="680" y2="260" stroke="#71717A" stroke-width="3" />
      <!-- Door Handles -->
      <rect x="310" y="245" width="24" height="6" rx="3" fill="#A1A1AA" />
      <rect x="445" y="245" width="24" height="6" rx="3" fill="#A1A1AA" />
      <!-- Round Headlight -->
      <circle cx="665" cy="255" r="14" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" />
      <circle cx="665" cy="255" r="8" fill="#38BDF8" fill-opacity="0.6" />
    `;
  } else if (v.body === "luxury_suv" || v.body === "large_suv") {
    carBodySvg = `
      <!-- Sleek Modern SUV Silhouette -->
      <path d="M120 330 L150 240 L210 215 L280 140 L530 135 L610 185 L690 240 L700 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Floating Roof Accent -->
      <path d="M270 135 L540 130 L615 180" stroke="${v.accent}" stroke-width="2.5" fill="none" opacity="0.8" />
      <!-- Windows -->
      <path d="M295 148 L390 145 L390 205 L235 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <rect x="405" y="145" width="115" height="60" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M535 145 L595 180 L590 205 L535 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <!-- Muscular Character Line -->
      <path d="M150 250 Q 400 240 685 248" stroke="${v.colorLight}" stroke-width="2.5" fill="none" />
      <!-- Flush Door Handles -->
      <rect x="365" y="235" width="26" height="5" rx="2.5" fill="${v.accent}" opacity="0.9" />
      <rect x="495" y="235" width="26" height="5" rx="2.5" fill="${v.accent}" opacity="0.9" />
      <!-- Dynamic LED Headlight -->
      <path d="M665 240 L695 245 L675 258 Z" fill="#F8FAFC" filter="drop-shadow(0 0 6px rgba(56,189,248,0.7))" />
    `;
  } else if (v.body === "coupe_suv") {
    carBodySvg = `
      <!-- Sweeping Coupe SUV Silhouette -->
      <path d="M115 330 L155 250 L200 220 L310 145 L510 140 L630 205 L695 248 L705 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Fastback Arch -->
      <path d="M210 220 Q 380 135 630 205" stroke="${v.accent}" stroke-width="2" fill="none" opacity="0.6" />
      <!-- Side Windows -->
      <path d="M315 155 L420 152 L420 205 L245 208 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M435 152 L505 152 L595 202 L435 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <!-- Sculpted Shoulder Line -->
      <path d="M140 260 Q 420 245 690 258" stroke="${v.colorLight}" stroke-width="2.5" fill="none" />
      <!-- Handles -->
      <rect x="390" y="240" width="24" height="5" rx="2.5" fill="#E2E8F0" />
      <rect x="495" y="240" width="24" height="5" rx="2.5" fill="#E2E8F0" />
      <!-- Swept-back Headlight -->
      <path d="M670 248 L698 252 L680 264 Z" fill="#F8FAFC" />
    `;
  } else if (v.body === "saloon_sport") {
    carBodySvg = `
      <!-- Low-slung Sports Grand Tourer -->
      <path d="M110 330 L140 250 L195 210 L310 160 L520 155 L630 215 L705 255 L710 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Sleek Window Line -->
      <path d="M315 170 L430 168 L430 208 L230 212 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M445 168 L515 168 L595 208 L445 208 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <!-- Side Vent -->
      <path d="M215 235 L225 285 L215 285 Z" fill="#0F172A" stroke="${v.accent}" stroke-width="1.5" />
      <!-- Low Character Crease -->
      <path d="M130 265 Q 420 255 700 265" stroke="${v.colorLight}" stroke-width="2" fill="none" />
      <!-- 4-Point LED Headlamp Cluster -->
      <circle cx="685" cy="255" r="3" fill="#38BDF8" />
      <circle cx="693" cy="255" r="3" fill="#38BDF8" />
      <circle cx="685" cy="263" r="3" fill="#38BDF8" />
      <circle cx="693" cy="263" r="3" fill="#38BDF8" />
    `;
  } else if (v.body === "wagon") {
    carBodySvg = `
      <!-- Long Luxury Station Wagon Silhouette -->
      <path d="M110 330 L130 220 L160 190 L270 145 L570 140 L625 185 L695 240 L705 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Long Roof Rails -->
      <line x1="280" y1="135" x2="560" y2="132" stroke="#94A3B8" stroke-width="3" />
      <!-- Triple Windows -->
      <path d="M280 152 L380 150 L380 200 L200 202 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <rect x="395" y="150" width="105" height="50" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M515 150 L565 150 L595 185 L515 200 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <!-- Elegant Waistline -->
      <line x1="135" y1="240" x2="695" y2="248" stroke="${v.colorLight}" stroke-width="2" />
      <rect x="360" y="228" width="24" height="5" rx="2.5" fill="#E2E8F0" />
      <rect x="470" y="228" width="24" height="5" rx="2.5" fill="#E2E8F0" />
    `;
  } else if (v.body === "luxury_van" || v.body === "box_mpv" || v.body === "mpv") {
    carBodySvg = `
      <!-- Imposing Luxury Van / MPV Silhouette -->
      <path d="M125 330 L135 180 L180 140 L530 130 L635 185 L690 250 L695 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Tinted Privacy Panoramic Windows -->
      <path d="M190 148 L320 145 L320 205 L155 205 Z" fill="#09090B" fill-opacity="0.9" stroke="#52525B" stroke-width="1" />
      <rect x="335" y="145" width="135" height="60" fill="#09090B" fill-opacity="0.9" stroke="#52525B" stroke-width="1" />
      <path d="M485 145 L545 145 L610 195 L485 205 Z" fill="#09090B" fill-opacity="0.9" stroke="#52525B" stroke-width="1" />
      <!-- Chrome Window Surround -->
      <path d="M185 142 L550 138 L620 195" stroke="${v.accent}" stroke-width="2" fill="none" opacity="0.8" />
      <!-- Sliding Door Rail -->
      <line x1="280" y1="245" x2="520" y2="245" stroke="#64748B" stroke-width="2" />
      <!-- Grand Chrome Shield Grille Front Edge -->
      <rect x="670" y="235" width="18" height="65" rx="4" fill="${v.accent}" opacity="0.85" />
    `;
  } else if (v.body === "safari_van") {
    carBodySvg = `
      <!-- Rugged 4WD Safari Tour Van with Pop-up Roof -->
      <path d="M130 330 L140 180 L180 145 L540 140 L635 195 L690 255 L695 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- Safari Pop-up Observation Roof Hatch -->
      <rect x="230" y="112" width="270" height="26" rx="4" fill="#D97706" stroke="#B45309" stroke-width="2" />
      <line x1="235" y1="125" x2="495" y2="125" stroke="#FDE68A" stroke-width="2" />
      <rect x="250" y="138" width="10" height="8" fill="#78350F" />
      <rect x="470" y="138" width="10" height="8" fill="#78350F" />
      <!-- Tour Windows -->
      <path d="M190 152 L330 150 L330 210 L160 210 Z" fill="#09090B" fill-opacity="0.8" stroke="#52525B" stroke-width="1" />
      <rect x="345" y="150" width="130" height="60" fill="#09090B" fill-opacity="0.8" stroke="#52525B" stroke-width="1" />
      <path d="M490 150 L545 150 L610 200 L490 210 Z" fill="#09090B" fill-opacity="0.8" stroke="#52525B" stroke-width="1" />
      <!-- Heavy Duty Bullbar -->
      <path d="M685 270 L705 270 L705 320 L685 320" stroke="#1C1917" stroke-width="6" fill="none" />
      <!-- Snorkel Accent -->
      <path d="M625 195 L625 140 L610 135" stroke="#292524" stroke-width="4" fill="none" />
    `;
  } else if (v.body === "commuter_van") {
    carBodySvg = `
      <!-- High Roof 15-Seater Commuter Van -->
      <path d="M120 330 L130 160 L180 120 L550 115 L645 180 L695 245 L700 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <!-- High Roof Extension Arch -->
      <path d="M180 120 L550 115 L640 175" stroke="#94A3B8" stroke-width="3" fill="none" />
      <!-- Multi-row Commuter Windows -->
      <rect x="185" y="140" width="85" height="65" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <rect x="285" y="140" width="85" height="65" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <rect x="385" y="140" width="85" height="65" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M485 140 L550 140 L615 185 L485 205 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <line x1="280" y1="245" x2="520" y2="245" stroke="#94A3B8" stroke-width="2" />
    `;
  } else {
    // Standard Hatch / Crossover
    carBodySvg = `
      <!-- Standard Hatchback / Crossover Silhouette -->
      <path d="M125 330 L155 245 L200 215 L285 155 L495 150 L585 200 L680 250 L690 330 Z" fill="url(#bodyGrad)" stroke="${v.colorLight}" stroke-width="2" />
      <path d="M295 162 L385 160 L385 210 L235 212 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <path d="M400 160 L485 160 L565 205 L400 210 Z" fill="#09090B" fill-opacity="0.85" stroke="#52525B" stroke-width="1" />
      <line x1="145" y1="255" x2="675" y2="258" stroke="${v.colorLight}" stroke-width="2" />
    `;
  }

  // Wheel configuration
  const wheelFrontX = 580;
  const wheelRearX = 220;
  const wheelY = 330;
  const wheelRadius = 50;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <!-- Studio Background Gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="60%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>

    <!-- Floor Reflection Gradient -->
    <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#334155" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </linearGradient>

    <!-- Car Body Metallic Gradient -->
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${v.colorLight}" />
      <stop offset="35%" stop-color="${v.color}" />
      <stop offset="85%" stop-color="${v.colorDark}" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>

    <!-- Wheel Rim Gradient -->
    <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F1F5F9" />
      <stop offset="50%" stop-color="#94A3B8" />
      <stop offset="85%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0F172A" />
    </radialGradient>

    <!-- Tire Gradient -->
    <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#18181B" />
      <stop offset="90%" stop-color="#27272A" />
      <stop offset="100%" stop-color="#09090B" />
    </radialGradient>

    <!-- Studio Shadow -->
    <radialGradient id="shadowGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.75" />
      <stop offset="70%" stop-color="#000000" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="800" height="500" fill="url(#bgGlow)" />

  <!-- Studio Ambient Lighting / Vignette -->
  <circle cx="400" cy="220" r="340" fill="${v.isVip ? '#EAB308' : '#38BDF8'}" fill-opacity="0.04" />

  <!-- Header Card Information -->
  <g transform="translate(36, 36)">
    <!-- Brand Tag -->
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="900" fill="${v.accent}" letter-spacing="1.5">PP · CAR RENTAL &amp; RIDESHARE</text>
    <!-- Headline -->
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" fill="#F8FAFC" letter-spacing="-0.5">${v.headline}</text>
    <!-- Subtitle -->
    <text x="0" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94A3B8">${v.subtitle}</text>
  </g>

  ${vipBadge}

  <!-- Under-Car Shadow -->
  <ellipse cx="410" cy="378" rx="310" ry="22" fill="url(#shadowGlow)" />

  <!-- Car Body Main Structure -->
  <g id="vehicle-body">
    ${carBodySvg}
  </g>

  <!-- Rear Wheel Assembly -->
  <g transform="translate(${wheelRearX}, ${wheelY})">
    <circle cx="0" cy="0" r="${wheelRadius}" fill="url(#tireGrad)" stroke="#27272A" stroke-width="4" />
    <circle cx="0" cy="0" r="${wheelRadius * 0.65}" fill="url(#rimGrad)" stroke="#E2E8F0" stroke-width="1.5" />
    <!-- 5-Spoke Sport Rim -->
    <line x1="0" y1="-28" x2="0" y2="28" stroke="#F8FAFC" stroke-width="4" />
    <line x1="-26" y1="-10" x2="26" y2="10" stroke="#F8FAFC" stroke-width="4" />
    <line x1="-18" y1="20" x2="18" y2="-20" stroke="#F8FAFC" stroke-width="4" />
    <circle cx="0" cy="0" r="8" fill="#0F172A" stroke="#E2E8F0" stroke-width="2" />
    <!-- Brake Caliper Accent -->
    <path d="M-12 -22 A 25 25 0 0 1 12 -22" stroke="${v.accent}" stroke-width="5" fill="none" stroke-linecap="round" />
  </g>

  <!-- Front Wheel Assembly -->
  <g transform="translate(${wheelFrontX}, ${wheelY})">
    <circle cx="0" cy="0" r="${wheelRadius}" fill="url(#tireGrad)" stroke="#27272A" stroke-width="4" />
    <circle cx="0" cy="0" r="${wheelRadius * 0.65}" fill="url(#rimGrad)" stroke="#E2E8F0" stroke-width="1.5" />
    <!-- 5-Spoke Sport Rim -->
    <line x1="0" y1="-28" x2="0" y2="28" stroke="#F8FAFC" stroke-width="4" />
    <line x1="-26" y1="-10" x2="26" y2="10" stroke="#F8FAFC" stroke-width="4" />
    <line x1="-18" y1="20" x2="18" y2="-20" stroke="#F8FAFC" stroke-width="4" />
    <circle cx="0" cy="0" r="8" fill="#0F172A" stroke="#E2E8F0" stroke-width="2" />
    <!-- Brake Caliper Accent -->
    <path d="M-12 -22 A 25 25 0 0 1 12 -22" stroke="${v.accent}" stroke-width="5" fill="none" stroke-linecap="round" />
  </g>

  <!-- Ugandan Pseudo Number Plate Card Banner (Bottom Center) -->
  <g transform="translate(36, 420)">
    <!-- Number Plate Badge -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="112" height="38" rx="6" fill="#FACC15" stroke="#CA8A04" stroke-width="2" />
      <!-- Black Border Rim -->
      <rect x="3" y="3" width="106" height="32" rx="4" fill="none" stroke="#000000" stroke-width="1.2" />
      <text x="56" y="24" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="900" fill="#000000" letter-spacing="1.5">${v.plate}</text>
    </g>

    <!-- Rates Display -->
    <g transform="translate(130, 4)">
      <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="0.5">TOWN RUN (DAILY)</text>
      <text x="0" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#F8FAFC">UGX ${v.townRate}</text>
    </g>

    <g transform="translate(310, 4)">
      <text x="0" y="14" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="0.5">UPCOUNTRY (DAILY)</text>
      <text x="0" y="30" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="${v.isVip ? '#FDE047' : '#38BDF8'}">UGX ${v.upcountryRate}</text>
    </g>

    <g transform="translate(510, 8)">
      <rect x="0" y="0" width="218" height="26" rx="13" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <circle cx="14" cy="13" r="5" fill="${v.isVip ? '#EAB308' : '#10B981'}" />
      <text x="26" y="17" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="700" fill="#F1F5F9">${v.isVip ? 'VIP Executive Service' : 'Instant Booking · Self Drive'}</text>
    </g>
  </g>
</svg>
`;
}

const customerDir = path.join(root, "apps", "customer", "public", "vehicles");
const partnerDir = path.join(root, "apps", "partner", "public", "vehicles");

fs.mkdirSync(customerDir, { recursive: true });
fs.mkdirSync(partnerDir, { recursive: true });

for (const v of VEHICLES) {
  const svg = generateSvg(v);
  fs.writeFileSync(path.join(customerDir, `${v.id}.svg`), svg, "utf8");
  fs.writeFileSync(path.join(partnerDir, `${v.id}.svg`), svg, "utf8");
  console.log(`Generated: ${v.id}.svg`);
}

console.log(`\nSuccessfully generated ${VEHICLES.length} vehicle SVGs in customer & partner apps.`);
