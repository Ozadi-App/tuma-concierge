# Demo media credits

Sandbox and practice-mode demo videos for Spotlight and live store channels.
They replace the Google `gtv-videos-bucket` samples, which now return 403.

**Hosting:** the files live in `apps/customer/public/demo-video-src/` and are served by
the `peebee-customer` Cloudflare Worker (static assets), the same way as
`apps/customer/public/demo-food/`.

Requests to `/demo-video/<name>` are handled by
`apps/customer/app/demo-video/[file]/route.ts`. That route adds HTTP Range (206) support,
because Workers Static Assets always return 200 with the full body and iOS/Safari then
refuses to play the MP4.

- Practice-mode data (`packages/shared/src/demo-marketplace.ts`) uses root-relative paths
  (`/demo-video/<name>.mp4`).
- API demo data (`apps/api/src/marketplace/routes.ts`) uses
  `https://app.peebee.online/demo-video/<name>.mp4`.

**Encoding:**

- H.264 High, 720x1280 (9:16 centre crop), 30 fps, CRF 25 with a 2 Mbps cap.
- No audio, `+faststart`, 8.6 to 12 s long.
- Each clip has a poster JPG with the same name.

**License:** all clips are from Pexels under the
[Pexels License](https://www.pexels.com/license/). It allows free commercial use and
modification, and attribution is not required (credited here anyway).

The license does not allow:

- implying that identifiable people endorse a product or business;
- selling unaltered copies;
- redistributing the clips on stock or wallpaper platforms;
- using them as trademarks or logos.

These clips are illustrative footage for fictional sandbox stores only. Don't reuse
them in paid advertising that features the people shown.

| File | Used for | Pexels source | Author | Trim |
| --- | --- | --- | --- | --- |
| `market.mp4` / `.jpg` | FreshMart "Fresh Morning Harvest" live | [Vibrant African market scene with vendor (33822003)](https://www.pexels.com/video/vibrant-african-market-scene-with-vendor-33822003/) | Carbell Sarfo | 2–12 s |
| `fashion.mp4` / `.jpg` | Fitting Room live, linen shirt video | [Woman trying the clothes in front of the mirror (7679420)](https://www.pexels.com/video/woman-trying-the-clothes-in-front-of-the-mirror-7679420/) | MART PRODUCTION | 4–14 s |
| `bakery.mp4` / `.jpg` | Live Baking / croissant bake | [Baking pastry bread (857167)](https://www.pexels.com/video/baking-pastry-bread-857167/) | "Vimeo" (Pexels contributor name) | 22–34 s |
| `earbuds.mp4` / `.jpg` | Tech unboxing live, ANC earbuds video, default go-live stream | [Wireless headphones (4982738)](https://www.pexels.com/video/wireless-headphones-4982738/) | H.Espinosa Films | 3–13 s |
| `skincare.mp4` / `.jpg` | Skincare live (black soap) | [Woman applying facial cream (4665239)](https://www.pexels.com/video/woman-applying-facial-cream-4665239/) | KATRIN BOLOVTSOVA | full 8.6 s |
| `sneakers.mp4` / `.jpg` | Sneaker drop live | [A pair of black sneakers (3752450)](https://www.pexels.com/video/a-pair-of-black-sneakers-3752450/) | Ricky Esquivel | 6–15 s |

Downloaded on 2026-10-15 via the official `https://www.pexels.com/download/video/<id>/`
links, which redirect to `videos.pexels.com`.
