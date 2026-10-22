-- Taxipress v5: who travels on a booking, what they bring, and a taxi's profile.
-- Applied by hand. The API checks hasColumn/hasTable and books seats only until this lands.

-- Passengers on one booking. seats = adults + child_seats (children beyond the lap allowance).
ALTER TABLE taxipress_bookings ADD COLUMN adults INTEGER NOT NULL DEFAULT 1;
ALTER TABLE taxipress_bookings ADD COLUMN children INTEGER NOT NULL DEFAULT 0;
ALTER TABLE taxipress_bookings ADD COLUMN child_seats INTEGER NOT NULL DEFAULT 0;
-- Luggage as {"standard":1,"large":2}; luggage_amount is what it added to amount.
ALTER TABLE taxipress_bookings ADD COLUMN luggage_json TEXT;
ALTER TABLE taxipress_bookings ADD COLUMN luggage_amount INTEGER NOT NULL DEFAULT 0;
-- none | boarding | priority | mobility
ALTER TABLE taxipress_bookings ADD COLUMN assistance TEXT;
-- en | lg | sw
ALTER TABLE taxipress_bookings ADD COLUMN language TEXT;
-- Booked for someone else: who travels and who to call in an emergency.
ALTER TABLE taxipress_bookings ADD COLUMN for_someone_else INTEGER NOT NULL DEFAULT 0;
ALTER TABLE taxipress_bookings ADD COLUMN traveller_name TEXT;
ALTER TABLE taxipress_bookings ADD COLUMN traveller_phone TEXT;
ALTER TABLE taxipress_bookings ADD COLUMN emergency_phone TEXT;

-- A taxi's profile. Empty until a driver or staff fill it in; the app hides what is empty.
ALTER TABLE taxipress_taxis ADD COLUMN photo_url TEXT;
ALTER TABLE taxipress_taxis ADD COLUMN vehicle_type TEXT;
ALTER TABLE taxipress_taxis ADD COLUMN colour TEXT;

-- A passenger's rating of a trip. Ratings show only once real ones exist.
CREATE TABLE IF NOT EXISTS taxipress_reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES taxipress_bookings(id),
  taxi_id TEXT NOT NULL REFERENCES taxipress_taxis(id),
  driver_id TEXT NOT NULL,
  passenger_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_taxipress_reviews_taxi ON taxipress_reviews (taxi_id, created_at);
