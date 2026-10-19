-- Migration 0103: a rider's own order visibility range.
-- NULL means the admin-wide default (setting rider_visibility_range_km) applies.
ALTER TABLE riders ADD COLUMN visibility_range_km REAL;
