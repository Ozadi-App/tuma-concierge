-- Peebee Gas: Fuel merchant network, pump attendant redemption, and rider fuel vouchers

CREATE TABLE IF NOT EXISTS fuel_stations (
  id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fuel_station_outlets (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES fuel_stations(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  lat REAL,
  lng REAL,
  phone TEXT,
  active_pumps INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_outlets_station ON fuel_station_outlets(station_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_outlets_code ON fuel_station_outlets(code);

CREATE TABLE IF NOT EXISTS fuel_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fuel', 'lubricant')),
  unit TEXT NOT NULL DEFAULT 'L',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fuel_station_prices (
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  product_id TEXT NOT NULL REFERENCES fuel_products(id),
  price_per_unit INTEGER NOT NULL CHECK (price_per_unit > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (outlet_id, product_id)
);

CREATE TABLE IF NOT EXISTS fuel_pump_attendants (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  user_id TEXT REFERENCES users(id),
  attendant_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pump_lane TEXT,
  status TEXT NOT NULL DEFAULT 'on_duty' CHECK (status IN ('on_duty', 'off_duty', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_attendants_outlet ON fuel_pump_attendants(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_attendants_code ON fuel_pump_attendants(attendant_code);

CREATE TABLE IF NOT EXISTS fuel_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  rider_id TEXT NOT NULL REFERENCES users(id),
  vehicle_plate TEXT NOT NULL,
  authorized_amount_ugx INTEGER NOT NULL CHECK (authorized_amount_ugx > 0),
  fuel_product_id TEXT REFERENCES fuel_products(id),
  outlet_id TEXT REFERENCES fuel_station_outlets(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scanned', 'dispensed', 'expired', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'rider_wallet' CHECK (source IN ('rider_wallet', 'fuel_advance', 'stage_voucher')),
  expires_at TEXT NOT NULL,
  dispensed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_codes_code ON fuel_codes(code, status);
CREATE INDEX IF NOT EXISTS idx_fuel_codes_rider ON fuel_codes(rider_id, status);

CREATE TABLE IF NOT EXISTS fuel_dispenses (
  id TEXT PRIMARY KEY,
  code_id TEXT REFERENCES fuel_codes(id),
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  attendant_id TEXT REFERENCES fuel_pump_attendants(id),
  rider_id TEXT NOT NULL REFERENCES users(id),
  vehicle_plate TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES fuel_products(id),
  price_per_litre INTEGER NOT NULL,
  litres_dispensed REAL NOT NULL,
  total_ugx INTEGER NOT NULL,
  pump_number INTEGER,
  receipt_ref TEXT UNIQUE NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'sandbox')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'disputed', 'reversed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_outlet ON fuel_dispenses(outlet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_rider ON fuel_dispenses(rider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_attendant ON fuel_dispenses(attendant_id, created_at);

CREATE TABLE IF NOT EXISTS fuel_attendant_shifts (
  id TEXT PRIMARY KEY,
  attendant_id TEXT NOT NULL REFERENCES fuel_pump_attendants(id),
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  start_pump_meter REAL DEFAULT 0,
  end_pump_meter REAL,
  total_dispenses INTEGER NOT NULL DEFAULT 0,
  total_litres REAL NOT NULL DEFAULT 0,
  total_amount_ugx INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_shifts_attendant ON fuel_attendant_shifts(attendant_id, status);

-- Seed Fuel Products
INSERT OR IGNORE INTO fuel_products (id, name, category, unit, sort_order, active) VALUES
  ('prod_petrol', 'Unleaded Petrol', 'fuel', 'L', 10, 1),
  ('prod_diesel', 'Ultra Low Sulphur Diesel', 'fuel', 'L', 20, 1),
  ('prod_vpower', 'Shell V-Power / Excellium', 'fuel', 'L', 30, 1),
  ('prod_oil_2t', '2T Two-Stroke Boda Oil', 'lubricant', 'L', 40, 1),
  ('prod_oil_4t', '4T Motorcycle Engine Oil', 'lubricant', 'L', 50, 1);

-- Seed Initial Gas Station Brands
INSERT OR IGNORE INTO fuel_stations (id, brand_name, company_name, status) VALUES
  ('station_total', 'TotalEnergies', 'TotalEnergies Marketing Uganda Ltd', 'active'),
  ('station_shell', 'Shell (Vivo Energy)', 'Vivo Energy Uganda Ltd', 'active'),
  ('station_rubis', 'Rubis Energy', 'Rubis Energy Uganda Ltd', 'active'),
  ('station_stabex', 'Stabex International', 'Stabex International Ltd', 'active'),
  ('station_hass', 'Hass Petroleum', 'Hass Petroleum Uganda Ltd', 'active'),
  ('station_cityoil', 'CityOil', 'CityOil Uganda Ltd', 'active');

-- Seed Station Outlets
INSERT OR IGNORE INTO fuel_station_outlets (id, station_id, name, code, address, lat, lng, phone, active_pumps, status) VALUES
  ('fout_total_lugogo', 'station_total', 'TotalEnergies Lugogo Bypass', 'GAS-TOT-01', 'Lugogo Bypass / Jinja Road, Kampala', 0.3275, 32.6021, '+256700100001', 6, 'active'),
  ('fout_shell_bugolobi', 'station_shell', 'Shell Bugolobi', 'GAS-SHL-02', 'Spring Road, Bugolobi, Kampala', 0.3168, 32.6184, '+256700100002', 4, 'active'),
  ('fout_rubis_kibuye', 'station_rubis', 'Rubis Kibuye Roundabout', 'GAS-RUB-03', 'Entebbe Road, Kibuye, Kampala', 0.2982, 32.5714, '+256700100003', 4, 'active'),
  ('fout_stabex_nansana', 'station_stabex', 'Stabex Nansana', 'GAS-STB-04', 'Hoima Road, Nansana, Wakiso', 0.3642, 32.5298, '+256700100004', 6, 'active'),
  ('fout_hass_wandegeya', 'station_hass', 'Hass Wandegeya', 'GAS-HSS-05', 'Bombo Road, Wandegeya, Kampala', 0.3341, 32.5721, '+256700100005', 4, 'active'),
  ('fout_cityoil_bombo', 'station_cityoil', 'CityOil Bombo Road', 'GAS-CTY-06', 'Bombo Road / Makerere Hill, Kampala', 0.3295, 32.5694, '+256700100006', 6, 'active');

-- Seed Pump Prices (UGX per Litre)
INSERT OR IGNORE INTO fuel_station_prices (outlet_id, product_id, price_per_unit) VALUES
  ('fout_total_lugogo', 'prod_petrol', 5450),
  ('fout_total_lugogo', 'prod_diesel', 5150),
  ('fout_total_lugogo', 'prod_vpower', 5850),
  ('fout_total_lugogo', 'prod_oil_2t', 12000),
  ('fout_total_lugogo', 'prod_oil_4t', 15000),

  ('fout_shell_bugolobi', 'prod_petrol', 5470),
  ('fout_shell_bugolobi', 'prod_diesel', 5170),
  ('fout_shell_bugolobi', 'prod_vpower', 5890),
  ('fout_shell_bugolobi', 'prod_oil_2t', 12500),
  ('fout_shell_bugolobi', 'prod_oil_4t', 15500),

  ('fout_rubis_kibuye', 'prod_petrol', 5430),
  ('fout_rubis_kibuye', 'prod_diesel', 5130),
  ('fout_rubis_kibuye', 'prod_oil_2t', 11800),
  ('fout_rubis_kibuye', 'prod_oil_4t', 14800),

  ('fout_stabex_nansana', 'prod_petrol', 5390),
  ('fout_stabex_nansana', 'prod_diesel', 5090),
  ('fout_stabex_nansana', 'prod_oil_2t', 11500),
  ('fout_stabex_nansana', 'prod_oil_4t', 14500),

  ('fout_hass_wandegeya', 'prod_petrol', 5420),
  ('fout_hass_wandegeya', 'prod_diesel', 5120),
  ('fout_hass_wandegeya', 'prod_oil_2t', 11900),
  ('fout_hass_wandegeya', 'prod_oil_4t', 14900),

  ('fout_cityoil_bombo', 'prod_petrol', 5440),
  ('fout_cityoil_bombo', 'prod_diesel', 5140),
  ('fout_cityoil_bombo', 'prod_oil_2t', 12000),
  ('fout_cityoil_bombo', 'prod_oil_4t', 15000);

-- Seed Demo Fuel Attendants for Quick Testing
INSERT OR IGNORE INTO fuel_pump_attendants (id, outlet_id, attendant_code, full_name, phone, pump_lane, status) VALUES
  ('fatt_lugogo_1', 'fout_total_lugogo', 'ATT-1001', 'Kato Dennis', '+256701111001', 'Pump 2 (Boda Lane)', 'on_duty'),
  ('fatt_bugolobi_1', 'fout_shell_bugolobi', 'ATT-1002', 'Nakato Sarah', '+256701111002', 'Pump 1 (Quick Lane)', 'on_duty'),
  ('fatt_stabex_1', 'fout_stabex_nansana', 'ATT-1003', 'Mugisha Paul', '+256701111003', 'Pump 4', 'on_duty');

-- Admin Control Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('service_gas_enabled', '1'),
  ('gas_rider_daily_limit_ugx', '60000'),
  ('gas_voucher_expiry_minutes', '60'),
  ('gas_platform_discount_percent', '0');
