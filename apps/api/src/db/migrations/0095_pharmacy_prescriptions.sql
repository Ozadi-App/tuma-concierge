-- Migration 0095: Pharmacy Prescriptions and NDA Medical Registry
-- Supporting dedicated pharmacy dispensing, doctor's slip uploads and NDA verification

CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  pharmacy_id TEXT,
  pharmacy_name TEXT,
  prescription_image_url TEXT NOT NULL,
  patient_notes TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  pharmacist_notes TEXT,
  dosage_instructions TEXT,
  quoted_items TEXT DEFAULT '[]',
  quoted_total_ugx INTEGER DEFAULT 0,
  delivery_address TEXT,
  delivery_fee_ugx INTEGER DEFAULT 5000,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_customer ON pharmacy_prescriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON pharmacy_prescriptions(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON pharmacy_prescriptions(status);
