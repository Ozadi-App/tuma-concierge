"use client";

import { BadgeCheck, HandCoins, PlusCircle, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OpenChannel } from "../../components/studio/OpenChannel";
import { Button, Card, Notice, Stat } from "../../components/studio/ui";
import { useMyChannel } from "../../components/studio/useMyChannel";
import { Avatar } from "../../components/channels/PostParts";
import { api } from "../../lib/api";
import { compactNumber, ugx } from "../../lib/channels";

export default function StudioHome() {
  const { channel, config, loading, error, reload } = useMyChannel();
  const [earnings, setEarnings] = useState<{ availableUgx: number; members: number } | null>(null);
  const [counts, setCounts] = useState<{ review: number; drafts: number; scheduled: number }>({ review: 0, drafts: 0, scheduled: 0 });

  useEffect(() => {
    if (!channel) return;
    if (config?.monetization?.enabled || config?.rewards?.enabled || config?.causes?.enabled) api.creatorEarnings().then(setEarnings).catch(() => setEarnings(null));
    api.myPosts().then((r) => setCounts({ review: r.posts.filter((p) => p.status === "review").length, drafts: r.posts.filter((p) => p.status === "draft").length, scheduled: r.posts.filter((p) => p.status === "scheduled").length })).catch(() => undefined);
  }, [channel, config]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (error && !config) return <Notice tone="error">{error}</Notice>;
  if (!channel) return config ? <OpenChannel config={config} onOpened={reload} /> : null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={channel.displayName} url={channel.avatarUrl} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-lg font-extrabold text-ink">{channel.displayName}{channel.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-gold" aria-label="Verified" />}</h1>
            <p className="truncate text-sm text-ink-500">@{channel.handle}</p>
          </div>
          <Link href={`/c/${channel.handle}`} className="shrink-0 rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-bold text-ink">View</Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Followers" value={compactNumber(channel.followerCount)} />
          <Stat label="Posts" value={compactNumber(channel.postCount)} />
          <Stat label="Members" value={earnings ? compactNumber(earnings.members) : "–"} />
        </div>
      </Card>

      {channel.status === "suspended" && <Notice tone="error">Your channel is suspended. Contact support for help.</Notice>}
      {counts.review > 0 && <Notice tone="info">{counts.review} post{counts.review === 1 ? " is" : "s are"} waiting for review before showing.</Notice>}

      <Link href="/studio/new" className="flex items-center gap-3 rounded-[28px] bg-gold p-5 text-ink-gold shadow-sm"><PlusCircle className="h-7 w-7" aria-hidden /><span><span className="block text-base font-extrabold">Create a post</span><span className="text-xs opacity-80">Video, pictures, a carousel, text or a poll</span></span></Link>
      {config?.live?.enabled && <Link href="/live" className="flex items-center gap-3 rounded-[28px] bg-red-600 p-5 text-white shadow-sm"><Radio className="h-7 w-7" aria-hidden /><span><span className="block text-base font-extrabold">Go live</span><span className="text-xs opacity-85">Use your phone camera. Followers watch and comment.</span></span></Link>}

      {earnings && (config?.monetization?.enabled || config?.rewards?.enabled) && (
        <Link href="/studio/money" className="flex items-center gap-3 rounded-[28px] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
          <HandCoins className="h-7 w-7 text-gold" aria-hidden />
          <span className="flex-1"><span className="block text-xs text-ink-500">Your earnings</span><span className="block text-xl font-extrabold text-ink">{ugx(earnings.availableUgx)}</span></span>
          <span className="text-sm font-bold text-gold">Open</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm font-bold text-ink">
        <Link href="/studio/posts" className="rounded-[24px] bg-[rgb(var(--surface-card))] p-4 shadow-sm">Your posts{counts.drafts + counts.scheduled > 0 && <span className="mt-1 block text-xs font-medium text-ink-500">{counts.drafts} drafts · {counts.scheduled} scheduled</span>}</Link>
        <Link href="/studio/profile" className="rounded-[24px] bg-[rgb(var(--surface-card))] p-4 shadow-sm">Profile &amp; video accounts</Link>
        {config?.monetization?.enabled && config.monetization.memberships && <Link href="/studio/members" className="rounded-[24px] bg-[rgb(var(--surface-card))] p-4 shadow-sm">Memberships</Link>}
        {config?.causes?.enabled && <Link href="/studio/causes" className="rounded-[24px] bg-[rgb(var(--surface-card))] p-4 shadow-sm">Causes</Link>}
      </div>
      <Button variant="plain" onClick={() => void reload()} className="w-full">Refresh</Button>
    </div>
  );
}
