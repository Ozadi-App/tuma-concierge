# Channels — controlling specification

**Status: v1.0. All phases below are built, and every feature ships switched off.**
The owner approved the recommended defaults and asked for everything to be built, with every option switchable from Admin so features that need a licence stay off until the business has one. Admin → Settings → Channels holds every option; its screen is drawn from `packages/shared/src/channels-config.ts`.
Migrations to apply by hand, in order: `0135_video_and_ads.sql`, then `0136_channels.sql`.

How to read this: **Decided** items come from the product owner and are binding. **Default** items are the recommendation used if no one objects. **[OPEN Qn]** items need an answer before the phase that depends on them starts. Section 17 lists every open question in one place.

---

## 1. Principles (binding)

1. **Stores and channels are separate.** A store sells products. A channel is a creator's own space. They never share a profile, an audience list or a content area, and a channel is not a kind of store.
2. **The Spotlight is shared.** It is Peebee's one public content feed. Stores, channels, restaurants, Learn schools and educators, drivers and any other Peebee account can put content into it. It is no longer a store-only feature.
3. **Everything happens inside the customer app.** Creators do not get a separate app. (Other modules may expose a "Post to Spotlight" action in their own apps; see §5.)
4. **No verification up front.** Customers use Peebee without verification, and that stays true. Opening a channel needs no ID. Verification (KYC) is asked for only at the moment someone wants to **withdraw money**: channel earnings, rewards converted to cash, or funds raised in a cause.
5. **Behaviour is Admin-controlled.** Every switch, limit, percentage, rate, time window and penalty is a setting in the Admin app, validated on the server, written to the activity log, and has a safe default. Code keeps only structural safety rails (for example "the creator's share is always under 100%"). This is a project rule (`CLAUDE.md`).
6. **Video belongs to its owner; the platform decides the ads.** Peebee takes only the video from a creator's provider, never that provider's ads or earnings.
7. **Features ship dark.** Each part is off until an admin turns it on, and it keeps working if its migration has not been applied yet.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Account** | A Peebee user. Anyone with an account can browse, buy, ride and so on. |
| **Channel** | A creator space owned by one account: handle, avatar, banner, bio, posts, followers, optional subscriptions and tips. An account can convert into a channel account at any time. |
| **Store** | A seller's shop (products, orders). Unchanged by this work. |
| **Publisher** | Whoever a post is shown as coming from: a channel, a store, a restaurant, a Learn school, a driver, or a personal profile (§5). |
| **Post** | One piece of content: video, image, carousel, text or poll, (later) live or audio. |
| **Spotlight** | The shared public feed that posts from any publisher can appear in. |
| **Cause** | A fundraising page with a goal, a deadline and an approval step. Owned by a channel. |
| **Points** | Credit earned from qualified views, convertible to money at a rate set in Admin. |
| **KYC** | Identity verification, requested only at withdrawal (§4). |

## 3. Architecture overview

```
 Publishers                     Posts                        Surfaces
 ───────────                    ─────                        ────────
 Channel  ─┐                                                ┌─ Spotlight feed
 Store    ─┤                                                ├─ Channel page  (/c/<handle>)
 Restaurant┤──►  one shared post model  ──►  rules  ──────► ├─ Store page    (store posts only)
 Learn    ─┤     (type, media, access,        (moderation,   ├─ Cause page    (/give/<slug>)
 Driver   ─┤      publisher, status)           ranking,      └─ Shared links  (no account needed)
 Personal ─┘                                   limits)
                         │
                         ▼
        Video layer (any provider) ──► Ad server ──► Rewards / Ledger / Wallet
```

- **One post model, many publishers.** A post records who it is published as (`publisher_type`, `publisher_id`) and where it may appear (`channel`, `spotlight`, or both). The Spotlight feed reads across every publisher.
- **Store content stays store-owned.** Content that carries products to sell is a store (or restaurant) post. Channel posts do not carry product sales (**[OPEN Q8]**).
- **Existing Spotlight.** Today it is store-based (`marketplace/spotlight`, `SpotlightItem` with `live`, `video`, `image`, `carousel`). The migration path keeps every existing store post working and gives it `publisher_type = store`.

## 4. Identity, access and verification

### 4.1 What each action needs

| Action | Needs |
|---|---|
| Browse, follow, watch, like, comment | An account (watching public posts can be allowed without one) |
| Open or convert to a channel | An account. **No ID.** |
| Post free content | A channel (or another publisher identity, §5) |
| Set up memberships, paid posts, tips | A channel. Money received is recorded and **held**. |
| Create a cause (draft, and submit for review) | A channel |
| Cause goes live | Admin approval (§9). KYC is not required to go live (**[OPEN Q9]**) |
| **Withdraw** earnings, converted rewards, or cause funds | **Verified KYC** — the only hard gate |
| Give to a cause, join a channel | Nothing for a donor on a public link (§10) |

### 4.2 KYC at withdrawal

1. The creator taps "Withdraw" or "Convert points to money".
2. If they are not verified, Peebee shows a short flow instead: confirm phone (already verified at sign-up), enter full name and ID number, photograph the ID, take a selfie, add the payout account (mobile money or bank).
3. A staff member reviews it in Admin (pending → approved or rejected with a reason). The creator is told the result.
4. Views, points, tips and donations keep accumulating while this is pending. Nothing is lost by delaying.
5. Once approved, one KYC covers channel earnings, rewards and cause withdrawals. The payout account name must match the verified name.

Follows the existing patterns: `merchant_policies.kyc_gate = before_withdrawal` and the `selfdrive_renter_kyc` / `merchant_kyc_cases` review tables. Documents are stored privately (R2), never shown on any public page.

Admin settings: KYC required for withdrawal (on), minimum and maximum single withdrawal, daily/monthly caps, cooling-off after a payout-account change, which ID types are accepted, minimum age to withdraw (**Default 18**), re-verification interval.

## 5. Publishers and the shared Spotlight

**Default publisher list** (each is an Admin switch):

| Publisher | Posts from | Notes |
|---|---|---|
| Channel | Customer app Studio | Full feature set: monetisation, followers, subscriptions |
| Store / merchant | Merchant app and customer app store tools | May tag its own products |
| Restaurant | Restaurant app | May tag its own dishes |
| Learn school / educator | Learn app | May tag its own courses |
| Driver / rider | Rider app and partner app | Safe-use rules apply (§5.2) |
| Personal profile | Customer app | A lightweight identity for an account that has not opened a channel (**[OPEN Q1]**) |

### 5.1 Posting experience

One shared composer and one shared post model, used everywhere. Each module's own app can open "Post to Spotlight" and the post is published under that module's identity. The channel Studio (analytics, scheduling, monetisation, causes) lives only in the customer app.

### 5.2 Rules

- Eligibility and limits per publisher type: posts per day, maximum video length, allowed post types, first-N posts reviewed before they show (Admin).
- **Drivers:** posting is blocked while a trip or delivery is active, and the in-feed experience is blocked on the rider side during a job. (Safety rail, with an Admin switch for the exact rule.)
- **Moderation:** automated filters, a report button on every post, an Admin review queue, takedown with reason, repeat-offender escalation. Whether posts are checked before or after they show is **[OPEN Q4]**.
- **Ranking:** following, recency, engagement and locale, with an Admin control for how much weight store, channel and other content each get. Paid promotion later.
- **A channel's posts** can be published to the channel only, or to the channel and the Spotlight. A Spotlight post from a channel always shows the channel name with a Follow button.

## 6. Content model

**Post types:** video, single image, carousel (multiple images), text or poll. Live and audio come later (**[OPEN Q10]**). The post type list is data, so new types can be added without redesigning the feed.

**Common fields:** caption, cover, tags, language, publisher, destinations, schedule time, access level, status.

**Status:** draft → scheduled → in review (when required) → published → removed.

**Access level (per post):** `free`, `members` (subscribers of the channel), `pay_per_view` (a price set by the creator). A video can also have a **free preview** of N seconds before the unlock prompt.

**Locked content is enforced on the server.** A locked video's address is signed and short-lived and issued only after the access check. The app hiding it is not enough. Providers that cannot sign are refused for locked videos.

## 7. Video infrastructure (built)

See `docs/video-and-ads.md`. Summary:
- One adapter contract: Cloudflare Stream, Mux, Cloudinary, Bunny Stream, plain video links.
- Creators use the platform's provider, connect their own account, or paste a link. Keys are encrypted and never returned.
- Peebee plays everything in its own player, so provider ads and earnings never apply.
- Admin controls: on/off, bring-your-own on/off, which providers, longest video, uploads per day, locked-video address lifetime.

## 8. Ads (built, server side)

See `docs/video-and-ads.md`. Peebee's ad server decides every ad: pre-roll and mid-roll, CPM / per finished view / per click, house ads, skip delay, frequency caps, VAST 4.0 output, signed single-count beacons, budgets, and a creator share (Admin, max 95%).
Still to do: the in-app player, advertiser self-serve, auction between campaigns, and paying the creator share out (§11).

## 9. Monetisation

### 9.1 Memberships (subscriptions)
Creator-set tiers (price, period, perks). Members get members-only posts, no ads (Admin switch), and optionally Peebee perks (wallet cashback, partner discounts — later). Billed from the wallet or mobile money; renewal and cancellation rules in Admin.

### 9.2 Pay-per-view and tips
Single-post unlocks and tips from the wallet or mobile money. Live gifts come with live streaming.

### 9.3 Platform cut
All rates are Admin settings. **Default proposal [OPEN Q5]:** memberships 15%, pay-per-view 20%, tips and gifts 10%, donations 0% (the donor may add an optional tip to Peebee).

### 9.4 Money handling
Every movement is a ledger transaction (`ledger/service.ts`). Creator income sits in a creator balance. **Withdrawal requires KYC (§4.2).** Payouts use the existing disbursement providers.

## 10. Causes (fundraising)

**Lifecycle:** draft → submitted → **approved by Admin** → live → ended (goal met, deadline reached, or closed) → settled.

- **Fields:** title, story, media, goal amount, deadline, beneficiary, payout destination.
- **Approval:** Admin reviews content and beneficiary and approves or rejects with a reason. Nothing is public until approved. Material edits after approval send it back for review.
- **Public page** at `/give/<slug>`, served without an account or the app: progress, donor wall (donors may be anonymous), updates, share buttons, link previews. Donations by mobile money as a guest (the guest-checkout pattern already exists). The link is stable, indexable and works if the app is not installed.
- **Held funds:** donations go into a ledger account for the cause. They are released to the creator only after KYC (§4.2) and according to the release rule (Admin): at the end, or at milestones.
- **If the goal is not met:** keep-what-you-raise by default; all-or-nothing as an Admin option (**[OPEN Q11]**).
- **Refunds:** rejected, cancelled or fraudulent causes refund donors in full.
- **Abuse controls:** limits on active causes per channel, report button, freeze by Admin, cooling-off on payout-account changes.

## 11. Rewards (views → points → money)

An independent module so the exchange rate can change as the platform grows.

- **Qualified view:** a rule set in Admin (for example 3 seconds or more, once per viewer per post per day, no self-views, no fraud flags).
- **Rate table:** dated entries in Admin ("from date X, N points = UGX Y"). A new row takes effect on its date; old rows are kept for the record.
- **Default [OPEN Q6]:** the rate is locked **when points are earned**. Raising the rate later applies only to new points, so Peebee never owes more than it planned.
- **Ad revenue share:** the creator share of ad events (§8) is recorded per event and credited here.
- **Cash-out:** points convert to wallet balance; withdrawal needs KYC. Admin: minimum balance, cooling-off, monthly cap.
- **Budget guard:** a monthly platform payout budget in Admin; if exceeded the conversion value is scaled down instead of failing.
- **Fraud:** velocity limits, duplicate-device and self-view detection, a review queue, the ability to void points.

## 12. Public links and discovery

- Channel: `peebee.online/c/<handle>`. Cause: `peebee.online/give/<slug>`. Post: `.../p/<id>`. Served by the customer app like product pages.
- Open Graph previews for WhatsApp and social shares; sitemap entries; no login to read public content.
- Handles: unique, reserved-word and impersonation checks, change limits.

## 13. Customer-app experience (summary)

Channel page (header, tabs: Posts / About / Causes, Follow, Subscribe). Studio (Create, Drafts, Scheduled, Analytics, Earnings, Monetise, Causes, Settings). Spotlight changes (any publisher, channel chip with Follow, access badges, inline unlock). Withdraw and Convert flows with the KYC step. Follows `FRONTEND.md` and the UI rules in `CLAUDE.md` (single-colour fields, existing colour tokens only).

## 14. Data model (planned)

New tables, each added by an additive hand-applied migration with a fallback until applied: `channels`, `channel_follows`, `channel_tiers`, `channel_subscriptions`, `posts`, `post_media`, `post_access_grants`, `post_reactions`, `post_comments`, `post_reports`, `causes`, `cause_updates`, `donations`, `reward_rates`, `reward_points`, `creator_kyc`, `creator_payout_accounts`, `creator_balances`. Already added (migration 0135): `video_credentials`, `video_assets`, `ad_campaigns`, `ad_creatives`, `ad_events`.

## 15. Admin app (planned)

One "Channels" area: switches (channels, each publisher type, each post type), limits, platform cuts, reward rate table and rules, ad settings (built), video settings (built), KYC rules and review queue, cause approval queue, moderation queue and reports, payout approvals, fraud flags, creator and channel management (suspend, verify badge). Everything recorded in the activity log.

## 16. Safety, compliance and risk

- **Funds held for others:** compliance position to be confirmed before real money is switched on (**[OPEN Q3]**). All money features default off.
- **Minors:** minimum age to open a channel and to withdraw (Admin; **Default 13 / 18**).
- **Content law and takedown:** terms for creators, copyright takedown flow, local-law removals.
- **Data:** KYC documents private and encrypted at rest; access limited by role and logged.
- **Abuse:** rate limits on posting, commenting, reporting and view counting.

## 17. Phases and acceptance

| # | Phase | Status |
|---|---|---|
| 0 | Video providers + ad server + Admin page | **Built** |
| 1 | Shared post model, Spotlight generalisation (publishers), channel page, Studio, follow, free posts | **Built** |
| 2 | Memberships, locked posts, free preview, pay-per-view, tips, in-app player with ads | **Built** |
| 3 | Creator KYC (at withdrawal only), balances, payout accounts, withdrawal | **Built** |
| 4 | Causes: approval, public give pages (guests too), held funds, release, refunds | **Built** |
| 5 | Rewards: counted views, dated rate table, cash-out, ad-share payout | **Built** |
| 6 | Live (stream address) and audio posts, gifts | **Built, off by default.** Not built: collaborations, advertiser self-serve, auction between campaigns, in-app live ingest |

Each phase is its own branch from current `origin/main`, its own pull request, lists any migration to apply by hand, and ships dark.

## 18. Decisions log

| # | Decision | Source |
|---|---|---|
| D1 | Video: bring-your-own providers plus a platform default; Peebee controls ads; only the video is brought in | Owner |
| D2 | Anyone with an account can open a channel, or convert their account | Owner |
| D3 | KYC is not asked upfront; it is asked only to withdraw channel earnings, rewards or cause funds | Owner |
| D4 | Stores and channels are separate; the Spotlight is shared across all modules and publishers, including drivers | Owner |
| D5 | Studio is inside the customer app; no separate creator app | Owner |
| D6 | Build everything with the recommended defaults; every option is switchable from Admin; licence-dependent features stay off until the owner turns them on | Owner |

## 19. Open questions

Numbering is stable; answers move into §18.

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Can an account post to the Spotlight without a channel (a lightweight personal profile)? | Yes, with a personal profile; a channel is the upgrade for followers and money |
| Q2 | Where do restaurants, schools and drivers post from? | Their own app, using the shared composer |
| Q3 | Compliance for holding donations and creator payouts in Uganda | Money features stay off until confirmed |
| Q4 | Moderation: before or after posts show? | After, with filters; first N posts of a new publisher reviewed first |
| Q5 | Platform cuts | Memberships 15%, pay-per-view 20%, tips 10%, donations 0% |
| Q6 | Reward rate: lock when earned, or convert on cash-out day? | Lock when earned |
| Q7 | Spotlight and stores: any store-specific behaviour to preserve? | Existing store posts migrate unchanged |
| Q8 | May channel posts tag store products (creator earns commission)? | No in v1 |
| Q9 | May a cause go live before the creator's KYC, with withdrawal gated? | Yes after Admin approval; an Admin threshold can require KYC first for large goals |
| Q10 | Live streaming and audio in v1? | Later (phase 6) |
| Q11 | If a cause misses its goal: keep what is raised, or refund everyone? | Keep what is raised |
| Q12 | Can people give to a cause only in UGX by mobile money? | Yes in v1 |
| Q13 | KYC: which documents, and any withdrawal limit before approval? | National ID photo, ID number, selfie, matching payout account; no withdrawals before approval |
| Q14 | Who reviews KYC and causes — one team or two? | Two permissions, assignable to the same people |
| Q15 | Minimum ages to open a channel and to withdraw? | 13 and 18 |
