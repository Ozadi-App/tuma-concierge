-- Taxipress open tickets: a seat bought at the normal fare that does not expire with its taxi.
-- The passenger can board any available taxi on the same route; the driver's code check moves the ticket onto that taxi.
-- Applied by hand. The API checks hasColumn and offers open tickets only after this lands (and only when staff switch them on).
ALTER TABLE taxipress_bookings ADD COLUMN open_ticket INTEGER NOT NULL DEFAULT 0;
-- When an open ticket stops being valid (UTC, 'YYYY-MM-DD HH:MM:SS'); NULL = never.
ALTER TABLE taxipress_bookings ADD COLUMN valid_until TEXT;
