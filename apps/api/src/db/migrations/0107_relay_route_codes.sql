-- Migration 0107: short codes for the two ends of a relay route, written like a ticket.
-- Additive only; the code checks for these first.

-- Every route runs both ways: stage A "KLA" and stage B "EBB" make the route "KLA ⇄ EBB",
-- travelled as "KLA - EBB" (A to B) or "EBB - KLA" (B to A). 2 to 4 capital letters.
-- Without a code the app uses the first three letters of the stage's name.
ALTER TABLE relay_routes ADD COLUMN stage_a_code TEXT;
ALTER TABLE relay_routes ADD COLUMN stage_b_code TEXT;
