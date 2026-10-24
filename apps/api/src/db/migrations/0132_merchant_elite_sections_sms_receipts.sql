-- Migration 0132: Merchant Elite Section Customizer & Automated SMS Receipts
-- Add theme_sections JSON column to stores for drag-and-drop / reorderable section customizer
ALTER TABLE stores ADD COLUMN theme_sections TEXT DEFAULT NULL;

-- Automated SMS / WhatsApp Receipts & Order Alerts Log Table
CREATE TABLE IF NOT EXISTS store_sms_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT NOT NULL, -- pos_receipt | order_confirmation | dispatch_alert | abandoned_cart
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered', -- delivered | failed | simulated
  external_message_id TEXT,
  cost_ugx INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_sms_logs_store_id ON store_sms_logs(store_id);
