/**
 * VAST 4.0 for any player that speaks it (Google IMA, Video.js, JW and similar). Peebee's own player
 * uses the JSON decision instead; VAST is here so a standard player can play Peebee's ads too.
 */
import type { AdDecision } from "./service.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export const EMPTY_VAST = '<?xml version="1.0" encoding="UTF-8"?><VAST version="4.0"></VAST>';

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

export function buildVast(ad: AdDecision, origin: string): string {
  const beacon = (event: string) => `${origin}/v1/ads/e/${ad.token}/${event}`;
  const c = ad.creative;
  const skip = c.skipAfterSeconds >= 0 ? ` skipoffset="${clock(c.skipAfterSeconds)}"` : "";
  const tracking = [["firstQuartile", "q25"], ["midpoint", "q50"], ["thirdQuartile", "q75"], ["complete", "complete"], ["skip", "skip"]]
    .map(([name, event]) => `<Tracking event="${name}">${cdata(beacon(event!))}</Tracking>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0"><Ad id="${esc(ad.serveId)}"><InLine>
<AdSystem>Peebee</AdSystem><AdTitle>${esc(c.headline ?? "Ad")}</AdTitle>
<Impression>${cdata(beacon("impression"))}</Impression>
<Creatives><Creative><Linear${skip}>
<Duration>${clock(c.durationSeconds)}</Duration>
<TrackingEvents>${tracking}</TrackingEvents>
<VideoClicks><ClickThrough>${cdata(`${origin}/v1/ads/click/${ad.token}`)}</ClickThrough></VideoClicks>
<MediaFiles><MediaFile delivery="progressive" type="video/mp4">${cdata(c.mediaUrl)}</MediaFile></MediaFiles>
</Linear></Creative></Creatives>
</InLine></Ad></VAST>`;
}
