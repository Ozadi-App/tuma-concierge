# Creator video and ads

Foundation for Channels. Everything here is off until an admin turns it on (Admin → Settings → Video & ads).
**Needs migration `apps/api/src/db/migrations/0134_video_and_ads.sql`, applied by hand.** Until then the endpoints answer "unavailable" and the Admin page says so.

## Video: one interface, many providers

`apps/api/src/video/` — each provider is an adapter (`adapters/*.ts`) behind one contract (`types.ts`). Adding a provider is one file plus one line in `adapters/index.ts`.

| Provider | Upload | Bring an existing video | Locked playback |
|---|---|---|---|
| Cloudflare Stream | direct, from the creator's device | by video id | yes (signed token) |
| Mux | direct | by asset id (needs a public playback id) | not yet |
| Cloudinary | direct (signed form) | by public id | not yet |
| Bunny Stream | direct (resumable) | by video GUID | not yet |
| Video link | — | any public https `.mp4`/`.webm`/`.m3u8` | no |

- **Two ways to use a provider.** *Platform*: Peebee's own account (keys in Admin, or env vars). *Bring your own*: the creator connects their own account; keys are checked against the provider before they are saved.
- **Keys** are AES-256-GCM encrypted in `video_credentials` and never returned by any endpoint.
- **Only the video comes across.** Peebee keeps the address and basic facts. Peebee's own player plays it, so the provider's ads and earnings never apply. Removing a video deletes it at the provider only when Peebee hosts it, never from a creator's own account.
- **Locked videos** (for memberships and pay-per-view, built in a later phase) only get a signed, short-lived address, and only from a provider that can sign. Providers that cannot are refused for locked videos rather than silently left open.
- **Links** must be public https; private addresses, odd ports, redirects and YouTube/TikTok/etc. pages are refused.

## Ads: Peebee decides, whichever provider holds the video

`apps/api/src/ads/` — campaigns (CPM, per finished view, or per click, or Peebee's own house promotions), creatives, and a serve/beacon loop.

1. Player asks `GET /v1/ads/plan?asset=` (where ads fall) and `GET /v1/ads/decision?asset=&slot=` (the ad, JSON) or `/v1/ads/vast` (VAST 4.0 for any standard player).
2. The decision carries a signed token. The player reports `impression`, `q25/q50/q75`, `complete`, `skip` to `/v1/ads/e/:token/:event`, and clicks go through `/v1/ads/click/:token`.
3. Each event counts once per served ad; a forged or expired token counts nothing. Money is kept in thousandths of a shilling, charged per the campaign's model, capped by its budget, and a creator watching their own video is never charged.
4. The creator's share (Admin setting, never above 95%) is recorded on each event; `GET /v1/ads/earnings` totals it. **Paying that out into the wallet/ledger belongs to the Rewards phase and is not wired yet.**

Admin controls: master switch, pre/mid-roll, minimum video length, mid-roll gap, ads per viewing and per hour, longest ad, skip delay, creator share, house-ad fallback, member ad-free. Every change is in the activity log.

## Not built yet (planned)

Posts and the Studio UI that call these endpoints; the in-app player UI (beacons and skip button); webhooks from providers (status is checked when the owner opens the video); a self-serve advertiser flow; auction between campaigns; paying creators their ad share.
