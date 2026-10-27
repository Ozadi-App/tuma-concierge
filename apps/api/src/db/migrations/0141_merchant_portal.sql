-- Merchant portal (stores.peebee.online): where a merchant's store is shown.
-- listed_in_app: the store appears when shoppers browse in the Peebee app.
-- web_store_enabled: the store has its own web storefront ([store].peebee.online) and takes orders there.
-- Existing stores keep working exactly as before: both default to on.
-- signup_channel records where the merchant registered ('app' or 'portal').
ALTER TABLE stores ADD COLUMN listed_in_app INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stores ADD COLUMN web_store_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE merchants ADD COLUMN signup_channel TEXT NOT NULL DEFAULT 'app';
