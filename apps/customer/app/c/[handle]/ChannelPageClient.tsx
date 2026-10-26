"use client";

import type { CauseView, ChannelView, PostView, TierView } from "@peebee/shared";
import { BadgeCheck, Link2, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "../../../components/channels/PostParts";
import { PostCard } from "../../../components/channels/PostCard";
import { PublicFrame } from "../../../components/channels/PublicFrame";
import { api, errorMessage } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { compactNumber, ugx } from "../../../lib/channels";
import { rememberReturnTo } from "../../../lib/return-to";
import { CauseCard } from "../../../components/channels/CauseCard";
import { ShareButton } from "../../../components/ShareButton";

type Tab = "posts" | "about" | "causes" | "join";

export function ChannelPageClient({ handle }: { handle: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<{ channel: ChannelView; tiers: TierView[]; causes: CauseView[]; membership: { id: string; tierId: string; status: string; currentPeriodEnd: string; autoRenew: boolean } | null } | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.publicChannel(handle), api.publicChannelPosts(handle)]);
      setData(d);
      setFollowing(d.channel.isFollowing);
      setFollowers(d.channel.followerCount);
      setPosts(p.posts);
      setCursor(p.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [handle]);
  useEffect(() => { void load(); }, [load, user?.id]);

  async function toggleFollow() {
    if (!data) return;
    if (!user) { rememberReturnTo(`/c/${handle}`); window.location.href = "/login"; return; }
    const was = following;
    setFollowing(!was);
    setFollowers((n) => n + (was ? -1 : 1));
    try {
      if (was) await api.unfollowChannel(data.channel.id); else await api.followChannel(data.channel.id);
    } catch {
      setFollowing(was);
      setFollowers((n) => n + (was ? 1 : -1));
    }
  }

  async function join(tierId: string) {
    if (!user) { rememberReturnTo(`/c/${handle}`); window.location.href = "/login"; return; }
    setBusy(tierId);
    setError(null);
    try {
      await api.subscribeToTier(tierId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function more() {
    if (cursor === null) return;
    const p = await api.publicChannelPosts(handle, cursor);
    setPosts((prev) => [...prev, ...p.posts]);
    setCursor(p.nextCursor);
  }

  if (error && !data) {
    return (
      <PublicFrame returnTo={`/c/${handle}`}>
        <div className="space-y-3 p-8 text-center"><h1 className="text-lg font-bold text-ink">Channel not found</h1><p className="text-sm text-ink-500">{error}</p><Link href="/spotlight" className="inline-block rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink-gold">Explore Spotlight</Link></div>
      </PublicFrame>
    );
  }
  if (!data) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  const c = data.channel;
  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "posts", label: "Posts", show: true },
    { id: "join", label: "Membership", show: data.tiers.length > 0 },
    { id: "causes", label: "Causes", show: data.causes.length > 0 },
    { id: "about", label: "About", show: true },
  ];

  return (
    <PublicFrame returnTo={`/c/${handle}`}>
      <div className="pb-24">
        <div className="relative h-36 w-full bg-gradient-to-br from-gold/40 to-gold/10">
          {c.bannerUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.bannerUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="relative z-10 -mt-10 space-y-3 px-4">
          <div className="flex items-end justify-between gap-3">
            <span className="rounded-full border-4 border-[rgb(var(--color-cream))]"><Avatar name={c.displayName} url={c.avatarUrl} size={80} /></span>
            <div className="flex items-center gap-2 pb-1">
              <ShareButton target={{ url: `/c/${c.handle}`, title: `${c.displayName} on Peebee`, text: c.bio || `Follow ${c.displayName} on Peebee` }} className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-ink" />
              {c.isOwner ? (
                <Link href="/studio" className="flex min-h-11 items-center gap-2 rounded-full bg-[rgb(var(--surface-muted))] px-5 text-sm font-bold text-ink"><Settings2 className="h-4 w-4" aria-hidden /> Studio</Link>
              ) : (
                <button type="button" onClick={toggleFollow} aria-pressed={following} className={`min-h-11 rounded-full px-6 text-sm font-bold ${following ? "bg-[rgb(var(--surface-muted))] text-ink" : "bg-gold text-ink-gold"}`}>{following ? "Following" : "Follow"}</button>
              )}
            </div>
          </div>
          <div>
            <h1 className="flex items-center gap-1.5 text-xl font-extrabold text-ink">{c.displayName}{c.verified && <BadgeCheck className="h-5 w-5 text-gold" aria-label="Verified" />}</h1>
            <p className="text-sm text-ink-500">@{c.handle}{c.category ? ` · ${c.category}` : ""}</p>
          </div>
          {c.bio && <p className="whitespace-pre-wrap break-words text-sm text-ink">{c.bio}</p>}
          <p className="flex gap-4 text-sm text-ink-500"><span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden /><strong className="text-ink">{compactNumber(followers)}</strong> followers</span><span><strong className="text-ink">{compactNumber(c.postCount)}</strong> posts</span></p>
          {data.membership && <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm font-semibold text-gold">You are a member until {new Date(`${data.membership.currentPeriodEnd.replace(" ", "T")}Z`).toLocaleDateString()}{!data.membership.autoRenew ? " (not renewing)" : ""}</p>}
        </div>

        <div role="tablist" className="mt-4 flex gap-2 overflow-x-auto px-4">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{t.label}</button>
          ))}
        </div>

        <div className="mt-4 space-y-4 px-4">
          {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {tab === "posts" && (
            <>
              {posts.length === 0 && <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-6 text-center text-sm text-ink-500">No posts yet.</p>}
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
              {cursor !== null && <button type="button" onClick={more} className="w-full rounded-full bg-[rgb(var(--surface-muted))] py-3 text-sm font-bold text-ink">Show more</button>}
            </>
          )}
          {tab === "join" && data.tiers.map((t) => {
            const mine = data.membership?.tierId === t.id;
            return (
              <div key={t.id} className="space-y-2 rounded-3xl bg-[rgb(var(--surface-card))] p-5 shadow-sm">
                <div className="flex items-baseline justify-between gap-3"><h2 className="text-base font-bold text-ink">{t.name}</h2><p className="text-sm font-bold text-gold">{ugx(t.priceUgx)}<span className="text-xs font-medium text-ink-500"> / {t.periodDays === 30 ? "month" : `${t.periodDays} days`}</span></p></div>
                {t.description && <p className="text-sm text-ink-500">{t.description}</p>}
                {t.perks.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{t.perks.map((x) => <li key={x}>{x}</li>)}</ul>}
                <button type="button" disabled={mine || !!data.membership || c.isOwner || busy !== null} onClick={() => join(t.id)} className="min-h-11 w-full rounded-full bg-gold text-sm font-bold text-ink-gold disabled:opacity-50">
                  {mine ? "You are a member" : c.isOwner ? "This is your tier" : busy === t.id ? "Joining…" : `Join for ${ugx(t.priceUgx)}`}
                </button>
              </div>
            );
          })}
          {tab === "causes" && data.causes.map((x) => <CauseCard key={x.id} cause={x} />)}
          {tab === "about" && (
            <div className="space-y-3 rounded-3xl bg-[rgb(var(--surface-card))] p-5 shadow-sm">
              <p className="whitespace-pre-wrap text-sm text-ink">{c.bio || "No bio yet."}</p>
              <p className="text-xs text-ink-500">On Peebee since {new Date(`${c.createdAt.replace(" ", "T")}Z`).toLocaleDateString()}</p>
              {c.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm font-semibold text-gold"><Link2 className="h-4 w-4" aria-hidden /> {l.label}</a>)}
            </div>
          )}
        </div>
      </div>
    </PublicFrame>
  );
}
