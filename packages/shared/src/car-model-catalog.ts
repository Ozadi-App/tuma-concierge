/** Reference vehicle data for the Uganda Self-drive & VIP catalog. Fuel use and boot
 * volumes are estimates; actual figures vary by model year, trim and condition. */
export type CarBodyType = "SUV" | "Saloon" | "Hatchback" | "Minivan" | "Van" | "Station Wagon" | "Coupe" | "Safari Van" | "Minibus";

export type CarModel = {
  id: string;
  make: string;
  model: string;
  variant?: string;
  seats: number;
  fuelLitresPerKm: number;
  luggageLitres?: number;
  luggageNote?: string;
  standardDailyUgx: number;
  bodyType?: CarBodyType;
  modelYear?: number;
  townDailyUgx?: number;
  upcountryDailyUgx?: number;
  isVip?: boolean;
  pseudoPlate?: string;
  image?: string;
  features?: string[];
  serviceGroup?: "standard" | "luxury" | "ambulance" | "cargo";
  defaultCategory?: string;
  driverPolicy?: "self_drive" | "with_driver_only";
};

const rows: CarModel[] = [
  // East African road-use references put the Fielder Hybrid near 21–24 km/L;
  // use a realistic local midpoint (about 4.5 L/100 km), not an ideal test-cycle figure.
  ["suzuki-alto","Suzuki","Alto",4,.041,177,100000],["toyota-passo","Toyota","Passo",5,.045,225,100000],["toyota-vitz","Toyota","Vitz / Yaris",5,.05,300,100000],["nissan-note","Nissan","Note",5,.05,330,100000],["honda-fit","Honda","Fit / Jazz",5,.053,354,100000],["toyota-aqua","Toyota","Aqua","Hybrid",5,.034,305,110000],["toyota-ractis","Toyota","Ractis",5,.056,429,100000],["toyota-belta","Toyota","Belta",5,.056,475,100000],["toyota-axio-petrol","Toyota","Corolla Axio","Petrol",5,.061,461,100000],["toyota-axio-hybrid","Toyota","Corolla Axio","Hybrid / WXB",5,.038,461,110000],["toyota-prius","Toyota","Prius","Hybrid sedan",5,.037,502,110000],["toyota-fielder-petrol","Toyota","Fielder","Petrol",5,.063,407,110000],["toyota-fielder-hybrid","Toyota","Fielder","Hybrid",5,.045,407,120000],["honda-fit-shuttle","Honda","Fit Shuttle","Hybrid",5,.042,490,120000],["toyota-probox","Toyota","Probox / Succeed",5,.063,400,100000],["toyota-sienta-petrol","Toyota","Sienta","Petrol",7,.067,150,150000],["toyota-sienta-hybrid","Toyota","Sienta","Hybrid",7,.042,150,160000],["toyota-rumion","Toyota","Rumion",5,.067,310,150000],["toyota-premio","Toyota","Premio",5,.069,490,120000],["toyota-wish","Toyota","Wish",7,.071,200,150000],
  ["toyota-ist","Toyota","IST",5,.063,435,100000],["toyota-porte","Toyota","Porte / Spade",5,.053,435,100000],["suzuki-swift","Suzuki","Swift",5,.05,265,100000],["toyota-auris","Toyota","Auris",5,.061,360,110000],["toyota-allion","Toyota","Allion",5,.069,490,120000],["honda-grace","Honda","Grace","Hybrid",5,.037,430,120000],["honda-insight","Honda","Insight","Hybrid sedan",5,.04,427,120000],["nissan-note-epower","Nissan","Note e-Power","Serial hybrid",5,.033,330,120000],["subaru-impreza","Subaru","Impreza","Hatchback 1.5/1.6L",5,.067,380,120000],["toyota-spacio","Toyota","Spacio",6,.071,160,130000],["toyota-isis","Toyota","Isis",7,.074,180,150000],["toyota-noah-hybrid","Toyota","Noah","1.8L Hybrid",8,.045,280,150000],["toyota-noah-petrol","Toyota","Noah","Petrol",8,.068,280,150000],["toyota-voxy-hybrid","Toyota","Voxy","1.8L Hybrid",8,.045,280,160000],["mazda-demio-petrol","Mazda","Demio / Mazda 2","Petrol",5,.053,280,100000],["mazda-demio-diesel","Mazda","Demio / Mazda 2","SkyActiv-D diesel",5,.038,280,110000],["mitsubishi-mirage","Mitsubishi","Mirage",5,.048,235,100000],["toyota-raize","Toyota","Raize","1.0L turbo",5,.053,369,150000],["daihatsu-rocky","Daihatsu","Rocky","1.0L turbo",5,.053,369,150000],
  ["toyota-ipsum","Toyota","Ipsum",7,.083,300,150000],["toyota-corolla","Toyota","Corolla",5,.068,470,100000],

  // --- Official Uganda Fleet & VIP Module Rates ---
  ["toyota-wish-2013","Toyota","Wish","2013 Model",7,.071,200,120000],
  ["toyota-noah-2013","Toyota","Noah","2013 Model",8,.068,280,150000],
  ["toyota-land-cruiser-tx-kaweesi","Toyota","Land Cruiser TX (Kaweesi)","2016 Model and above",7,.095,620,450000],
  ["toyota-prado-ronaldo-2008","Toyota","Land Cruiser Prado (Ronaldo)","2008 Model",7,.105,580,300000],
  ["subaru-impreza-2016","Subaru","Impreza","2016 Model",5,.067,380,150000],
  ["toyota-hiace-high-roof-15","Toyota","Hiace High Roof Commuter","15 Seater Commuter",15,.110,800,300000],
  ["toyota-harrier-2014","Toyota","Harrier","2014 Model",5,.075,456,200000],
  ["range-rover-velar-2018","Range Rover","Velar","2018 Model",5,.092,673,1000000],
  ["range-rover-sport-2018","Range Rover","Sport","2018 Model",5,.105,780,1000000],
  ["mercedes-benz-station-wagon-2024","Mercedes-Benz","Station Wagon","2024 Model",5,.078,640,1700000],
  ["mercedes-benz-g-wagon","Mercedes-Benz","G-Wagon","G 63 / AMG",5,.140,667,2000000],
  ["mercedes-benz-gle-coupe","Mercedes-Benz","GLE Coupe","Coupe SUV",5,.098,655,1200000],
  ["porsche-panamera-2013","Porsche","Panamera","2013 Model",4,.098,445,1200000],
  ["toyota-alphard-hybrid","Toyota","Alphard Hybrid","Executive Lounge",7,.065,500,600000],
  ["mercedes-benz-v-class","Mercedes-Benz","V-Class","VIP Lounge",7,.075,610,700000],
  ["safari-van-10-seater","Toyota","Safari Van","10 Seater Pop-up Roof",10,.100,750,200000],
  ["toyota-alphard-petrol","Toyota","Alphard","Petrol Standard",7,.089,500,200000],
].map((row) => {
  // Rows with no variant (e.g. "Alto") leave that column out, so read the optional text variant first.
  const [id, make, model, ...rest] = row as [string, string, string, ...Array<string | number>];
  const variant = typeof rest[0] === "string" ? String(rest.shift()) : undefined;
  const [seats, fuelLitresPerKm, luggageLitres, standardDailyUgx] = rest.map(Number);
  return { id, make, model, ...(variant ? { variant } : {}), seats, fuelLitresPerKm, luggageLitres, standardDailyUgx } as CarModel;
});

const luggageNotes: Record<string, string> = {
  "toyota-fielder-petrol": "(about 872 L with rear seats folded)", "toyota-fielder-hybrid": "(about 872 L with rear seats folded)",
  "toyota-probox": "(up to about 1,800 L with rear bench folded)", "toyota-sienta-petrol": "(about 500 L with third row folded)",
  "toyota-sienta-hybrid": "(about 500 L with third row folded)", "toyota-spacio": "(about 410 L with rear seats folded)",
  "toyota-isis": "(about 450 L with third row folded)", "toyota-noah-hybrid": "(about 750 L with third row folded)",
  "toyota-noah-petrol": "(about 750 L with third row folded)", "toyota-voxy-hybrid": "(about 750 L with third row folded)",
  "toyota-wish": "(about 410 L with third row folded)",
  "toyota-wish-2013": "(about 410 L with third row folded)",
  "toyota-noah-2013": "(about 750 L with third row folded)",
  "toyota-land-cruiser-tx-kaweesi": "(up to 1,930 L with folded rows)",
  "toyota-prado-ronaldo-2008": "(up to 1,850 L with folded rows)",
  "toyota-hiace-high-roof-15": "(spacious luggage bay behind 15 seats)",
  "range-rover-velar-2018": "(luxury luggage bay with power tailgate)",
  "range-rover-sport-2018": "(executive luggage bay, 780 L capacity)",
  "mercedes-benz-station-wagon-2024": "(elongated estate load compartment)",
  "mercedes-benz-g-wagon": "(spacious upright cargo bay)",
  "mercedes-benz-gle-coupe": "(wide luggage bay with coupe hatch)",
  "porsche-panamera-2013": "(sports hatchback luggage capacity)",
  "toyota-alphard-hybrid": "(captain chair executive cabin with luggage space)",
  "mercedes-benz-v-class": "(VIP luggage room for up to 8 large suitcases)",
  "safari-van-10-seater": "(safari gear and luggage compartments)",
  "toyota-alphard-petrol": "(flexible seating and rear boot space)",
};

/** Specialized fleet metadata for the Uganda module rates and VIP classification. */
const FLEET_METADATA: Record<string, Partial<CarModel>> = {
  "toyota-wish-2013": {
    bodyType: "Minivan", modelYear: 2013, townDailyUgx: 120000, upcountryDailyUgx: 180000, isVip: false,
    pseudoPlate: "UBM 314A", image: "/vehicles/toyota-wish-2013.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "Bluetooth", "Automatic"], driverPolicy: "self_drive",
  },
  "toyota-noah-2013": {
    bodyType: "Minivan", modelYear: 2013, townDailyUgx: 150000, upcountryDailyUgx: 200000, isVip: false,
    pseudoPlate: "UBP 520B", image: "/vehicles/toyota-noah-2013.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "Bluetooth", "Automatic"], driverPolicy: "self_drive",
  },
  "toyota-land-cruiser-tx-kaweesi": {
    bodyType: "SUV", modelYear: 2016, townDailyUgx: 450000, upcountryDailyUgx: 500000, isVip: true,
    pseudoPlate: "UBA 777K", image: "/vehicles/toyota-land-cruiser-tx-kaweesi.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "4WD", "USB charging"], driverPolicy: "self_drive",
  },
  "toyota-prado-ronaldo-2008": {
    bodyType: "SUV", modelYear: 2008, townDailyUgx: 300000, upcountryDailyUgx: 350000, isVip: false,
    pseudoPlate: "UBK 404R", image: "/vehicles/toyota-prado-ronaldo-2008.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "Bluetooth", "Automatic", "4WD"], driverPolicy: "self_drive",
  },
  "subaru-impreza-2016": {
    bodyType: "Hatchback", modelYear: 2016, townDailyUgx: 150000, upcountryDailyUgx: 200000, isVip: false,
    pseudoPlate: "UBL 109S", image: "/vehicles/subaru-impreza-2016.svg", defaultCategory: "peebee-car-normal",
    features: ["Air conditioning", "Bluetooth", "Automatic", "4WD"], driverPolicy: "self_drive",
  },
  "toyota-hiace-high-roof-15": {
    bodyType: "Minibus", modelYear: 2018, townDailyUgx: 300000, upcountryDailyUgx: 350000, isVip: false,
    pseudoPlate: "UBQ 880H", image: "/vehicles/toyota-hiace-high-roof-15.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "USB charging"], driverPolicy: "with_driver_only",
  },
  "toyota-harrier-2014": {
    bodyType: "SUV", modelYear: 2014, townDailyUgx: 200000, upcountryDailyUgx: 250000, isVip: false,
    pseudoPlate: "UBH 612T", image: "/vehicles/toyota-harrier-2014.svg", defaultCategory: "peebee-car-normal",
    features: ["Air conditioning", "Bluetooth", "Automatic"], driverPolicy: "self_drive",
  },
  "range-rover-velar-2018": {
    bodyType: "SUV", modelYear: 2018, townDailyUgx: 1000000, upcountryDailyUgx: 1500000, isVip: true,
    pseudoPlate: "UBV 001V", image: "/vehicles/range-rover-velar-2018.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "4WD", "USB charging"], driverPolicy: "self_drive",
  },
  "range-rover-sport-2018": {
    bodyType: "SUV", modelYear: 2018, townDailyUgx: 1000000, upcountryDailyUgx: 1500000, isVip: true,
    pseudoPlate: "UBS 007R", image: "/vehicles/range-rover-sport-2018.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "4WD", "USB charging"], driverPolicy: "self_drive",
  },
  "mercedes-benz-station-wagon-2024": {
    bodyType: "Station Wagon", modelYear: 2024, townDailyUgx: 1700000, upcountryDailyUgx: 2500000, isVip: true,
    pseudoPlate: "UBW 024M", image: "/vehicles/mercedes-benz-station-wagon-2024.svg", defaultCategory: "peebee-luxury-sedan",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "USB charging"], driverPolicy: "self_drive",
  },
  "mercedes-benz-g-wagon": {
    bodyType: "SUV", modelYear: 2021, townDailyUgx: 2000000, upcountryDailyUgx: 2500000, isVip: true,
    pseudoPlate: "UBG 001G", image: "/vehicles/mercedes-benz-g-wagon.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "4WD", "USB charging"], driverPolicy: "self_drive",
  },
  "mercedes-benz-gle-coupe": {
    bodyType: "Coupe", modelYear: 2020, townDailyUgx: 1200000, upcountryDailyUgx: 1800000, isVip: true,
    pseudoPlate: "UBX 999E", image: "/vehicles/mercedes-benz-gle-coupe.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "4WD", "USB charging"], driverPolicy: "self_drive",
  },
  "porsche-panamera-2013": {
    bodyType: "Saloon", modelYear: 2013, townDailyUgx: 1200000, upcountryDailyUgx: 1500000, isVip: true,
    pseudoPlate: "UBP 911P", image: "/vehicles/porsche-panamera-2013.svg", defaultCategory: "peebee-luxury-sedan",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "USB charging"], driverPolicy: "self_drive",
  },
  "toyota-alphard-hybrid": {
    bodyType: "Minivan", modelYear: 2019, townDailyUgx: 600000, upcountryDailyUgx: 700000, isVip: true,
    pseudoPlate: "UBA 600H", image: "/vehicles/toyota-alphard-hybrid.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "USB charging"], driverPolicy: "self_drive",
  },
  "mercedes-benz-v-class": {
    bodyType: "Minivan", modelYear: 2020, townDailyUgx: 700000, upcountryDailyUgx: 900000, isVip: true,
    pseudoPlate: "UBV 700M", image: "/vehicles/mercedes-benz-v-class.svg", defaultCategory: "peebee-luxury-suv",
    serviceGroup: "luxury", features: ["Air conditioning", "Bluetooth", "Automatic", "USB charging"], driverPolicy: "self_drive",
  },
  "safari-van-10-seater": {
    bodyType: "Safari Van", modelYear: 2017, townDailyUgx: 200000, upcountryDailyUgx: 250000, isVip: false,
    pseudoPlate: "UBT 100S", image: "/vehicles/safari-van-10-seater.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "4WD"], driverPolicy: "self_drive",
  },
  "toyota-alphard-petrol": {
    bodyType: "Minivan", modelYear: 2012, townDailyUgx: 200000, upcountryDailyUgx: 250000, isVip: false,
    pseudoPlate: "UBA 200T", image: "/vehicles/toyota-alphard-petrol.svg", defaultCategory: "peebee-car-large",
    features: ["Air conditioning", "Bluetooth", "Automatic"], driverPolicy: "self_drive",
  },
};

export const CAR_MODEL_CATALOG: CarModel[] = rows.map((model) => {
  const meta = FLEET_METADATA[model.id] ?? {};
  const isVip = meta.isVip ?? (model.standardDailyUgx >= 500000 || (meta.upcountryDailyUgx ?? 0) >= 500000);
  const townDailyUgx = meta.townDailyUgx ?? model.standardDailyUgx;
  const upcountryDailyUgx = meta.upcountryDailyUgx ?? Math.round(model.standardDailyUgx * 1.3);
  return {
    ...model,
    luggageNote: luggageNotes[model.id],
    bodyType: meta.bodyType ?? getCarBodyType(model),
    modelYear: meta.modelYear,
    townDailyUgx,
    upcountryDailyUgx,
    isVip,
    pseudoPlate: meta.pseudoPlate,
    image: meta.image,
    features: meta.features,
    serviceGroup: meta.serviceGroup ?? (isVip ? "luxury" : "standard"),
    defaultCategory: meta.defaultCategory,
    driverPolicy: meta.driverPolicy ?? "self_drive",
  };
});

/** Returns true if the daily rate (town or upcountry) qualifies for VIP (>= 500,000 UGX). */
export function isVipRate(rateUgx: number): boolean {
  return Number(rateUgx) >= 500_000;
}

/** Body type helper: infers or retrieves body type from catalog data. */
export function getCarBodyType(model: Pick<CarModel, "make" | "model" | "bodyType">): CarBodyType {
  if (model.bodyType) return model.bodyType;
  const name = `${model.make} ${model.model}`.toLowerCase();
  if (/suv|prado|cruiser|harrier|velar|g-wagon|gle|x-trail|rocky|raize/i.test(name)) return "SUV";
  if (/station wagon|estate|wagon/i.test(name)) return "Station Wagon";
  if (/coupe/i.test(name)) return "Coupe";
  if (/safari/i.test(name)) return "Safari Van";
  if (/hiace commuter|commuter|high roof|minibus/i.test(name)) return "Minibus";
  if (/panel van|probox|van/i.test(name)) return "Van";
  if (/wish|noah|voxy|alphard|sienta|ipsum|isis|spacio|stepwgn|serena/i.test(name)) return "Minivan";
  if (/impreza|demio|fit|vitz|alto|swift|aqua|note|passo|mirage|auris/i.test(name)) return "Hatchback";
  return "Saloon";
}

/** System helper that automatically populates car profile details from make and model selection. */
export function getCarDefaults(model: CarModel) {
  const isVip = model.isVip ?? isVipRate(model.townDailyUgx ?? model.standardDailyUgx);
  const bodyType = getCarBodyType(model);
  const isSuvOr4wd = bodyType === "SUV" || bodyType === "Safari Van" || /4wd|cruiser|prado|impreza/i.test(`${model.make} ${model.model}`);

  return {
    make: model.make,
    model: `${model.model}${model.variant ? ` ${model.variant}` : ""}`,
    modelCatalogId: model.id,
    bodyType,
    year: model.modelYear ? String(model.modelYear) : "2018",
    seatCapacity: String(model.seats),
    serviceClass: isVip || model.standardDailyUgx > 100_000 ? ("comfort" as const) : ("convenient" as const),
    conditionGrade: isVip ? ("excellent" as const) : ("good" as const),
    isVip,
    townDailyUgx: model.townDailyUgx ?? model.standardDailyUgx,
    upcountryDailyUgx: model.upcountryDailyUgx ?? Math.round(model.standardDailyUgx * 1.3),
    features: model.features ?? [
      "Air conditioning",
      ...(isVip || model.standardDailyUgx > 120_000 ? ["Bluetooth", "Automatic"] : ["Automatic"]),
      ...(isVip ? ["USB charging"] : []),
      ...(isSuvOr4wd ? ["4WD"] : []),
    ],
    pseudoPlate: model.pseudoPlate ?? "UBA 101P",
    image: model.image,
    categoryHint: model.defaultCategory ?? (isVip ? "peebee-luxury-suv" : model.seats >= 7 ? "peebee-car-large" : "peebee-car-normal"),
  };
}
