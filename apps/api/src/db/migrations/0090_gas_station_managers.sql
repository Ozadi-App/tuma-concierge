-- Migration 0090: Peebee Gas Station Manager Portal, Attendant Commissioning, and Fund Withdrawals

CREATE TABLE IF NOT EXISTS fuel_station_managers (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  user_id TEXT REFERENCES users(id),
  manager_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin TEXT NOT NULL DEFAULT '1234',
  role TEXT NOT NULL DEFAULT 'station_manager' CHECK (role IN ('station_manager', 'supervisor', 'dealer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_managers_outlet ON fuel_station_managers(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_managers_code ON fuel_station_managers(manager_code);

CREATE TABLE IF NOT EXISTS fuel_station_withdrawals (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  manager_id TEXT NOT NULL,
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx > 0),
  fee_ugx INTEGER NOT NULL DEFAULT 0,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('momo', 'bank')),
  destination_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reference TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_withdrawals_outlet ON fuel_station_withdrawals(outlet_id, created_at);

CREATE TABLE IF NOT EXISTS fuel_station_payout_accounts (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL REFERENCES fuel_station_outlets(id),
  type TEXT NOT NULL CHECK (type IN ('momo', 'bank')),
  account_ref TEXT NOT NULL,
  account_name TEXT NOT NULL,
  network_or_bank TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_payout_accounts_outlet ON fuel_station_payout_accounts(outlet_id);

-- Commissioning columns on fuel_pump_attendants
ALTER TABLE fuel_pump_attendants ADD COLUMN commission_status TEXT DEFAULT 'approved';
ALTER TABLE fuel_pump_attendants ADD COLUMN commissioned_by TEXT;
ALTER TABLE fuel_pump_attendants ADD COLUMN commissioned_at TEXT;
ALTER TABLE fuel_pump_attendants ADD COLUMN pin TEXT DEFAULT '1234';

-- Seed default Station Managers for partner outlets
INSERT OR IGNORE INTO fuel_station_managers (id, outlet_id, manager_code, full_name, phone, pin, role, status) VALUES
  ('fmgr_tot_01', 'fout_total_lugogo', 'MGR-TOT-01', 'Patrick Semakula', '+256701999001', '1234', 'dealer', 'active'),
  ('fmgr_shl_02', 'fout_shell_bugolobi', 'MGR-SHL-02', 'Grace Akello', '+256701999002', '1234', 'station_manager', 'active'),
  ('fmgr_rub_03', 'fout_rubis_kibuye', 'MGR-RUB-03', 'Moses Okot', '+256701999003', '1234', 'station_manager', 'active'),
  ('fmgr_stb_04', 'fout_stabex_nansana', 'MGR-STB-04', 'Hassan Ssebaggala', '+256701999004', '1234', 'station_manager', 'active'),
  ('fmgr_hss_05', 'fout_hass_wandegeya', 'MGR-HSS-05', 'Amina Nalwanga', '+256701999005', '1234', 'station_manager', 'active'),
  ('fmgr_cty_06', 'fout_cityoil_bombo', 'MGR-CTY-06', 'Ronald Tumwine', '+256701999006', '1234', 'station_manager', 'active');

-- Seed default station payout accounts
INSERT OR IGNORE INTO fuel_station_payout_accounts (id, outlet_id, type, account_ref, account_name, network_or_bank, is_primary) VALUES
  ('fpay_tot_momo', 'fout_total_lugogo', 'momo', '+256772100001', 'TotalEnergies Lugogo Bypass Settlement', 'MTN', 1),
  ('fpay_tot_bank', 'fout_total_lugogo', 'bank', '9030018822331', 'TotalEnergies Marketing Uganda Ltd', 'Stanbic Bank', 0),
  ('fpay_shl_momo', 'fout_shell_bugolobi', 'momo', '+256700100002', 'Shell Bugolobi Station Account', 'Airtel', 1);
