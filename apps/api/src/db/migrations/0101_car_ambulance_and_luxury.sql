-- Migration 0101: Peebee Car — Ambulance (emergency) and Luxury (weddings, parties, red carpet) vehicle categories.
-- Requires 0065. APPLY BY HAND.
--
-- Only adds columns and rows; nothing existing is rebuilt or changed. Existing categories are 'standard'.
-- Code that reads the new columns checks for them first, so it keeps working if this is applied after the deploy.

-- Which kind of service a category is. Luxury and Ambulance categories are 'passenger' kind (they carry people) but
-- are kept out of the ordinary Convenient / Comfort taxi matching.
ALTER TABLE vehicle_categories ADD COLUMN service_group TEXT NOT NULL DEFAULT 'standard' CHECK (service_group IN ('standard', 'luxury', 'ambulance'));
-- Luxury hire: UGX per hour the car and chauffeur stay with the customer (added to the trip fare). 0 = not offered by the hour.
ALTER TABLE vehicle_categories ADD COLUMN rate_per_hour INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicle_categories ADD COLUMN description TEXT;

-- A note from the customer to the driver (what is happening, or what the occasion is) and, for Luxury, hours of hire.
ALTER TABLE car_bookings ADD COLUMN trip_note TEXT;
ALTER TABLE car_bookings ADD COLUMN hire_hours INTEGER;

-- Starting categories. The prices are placeholders: confirm them in Admin → Settings → Car → Categories.
-- Both are on so that owners can register vehicles in them. Customers only see Luxury or Ambulance once at least one
-- vehicle of that kind has been approved, so an Ambulance button never appears before there is an ambulance.
INSERT OR IGNORE INTO vehicle_categories (id, kind, service_group, name, seats, size_label, rate_per_km, minimum_fare, rate_per_hour, description, active, sort) VALUES
  ('peebee-luxury-sedan', 'passenger', 'luxury', 'Luxury sedan', 4, 'Chauffeur driven', 5000, 60000, 40000, 'Mercedes, BMW, Lexus or similar, with a chauffeur. For weddings, parties and VIP transfers.', 1, 20),
  ('peebee-luxury-suv', 'passenger', 'luxury', 'Luxury SUV', 6, 'Chauffeur driven', 7000, 90000, 60000, 'Range Rover, Land Cruiser V8 or similar. For red carpet arrivals, convoys and guests of honour.', 1, 21),
  ('peebee-luxury-limo', 'passenger', 'luxury', 'Limousine / event car', 8, 'Chauffeur driven', 12000, 200000, 120000, 'Stretch limousine, classic or exotic car for weddings, celebrity arrivals and special nights.', 1, 22),
  ('peebee-ambulance-basic', 'passenger', 'ambulance', 'Ambulance', 3, 'Stretcher and oxygen', 4000, 50000, 0, 'Patient transport with a stretcher and oxygen, for emergencies and hospital transfers.', 1, 30),
  ('peebee-ambulance-icu', 'passenger', 'ambulance', 'ICU ambulance', 3, 'Advanced life support', 8000, 120000, 0, 'Ventilator, monitor and a trained paramedic on board, for critical patients.', 1, 31);
