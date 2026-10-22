"use client";

import { parseGiftOptions, type ChannelsPublicConfig, type PostView, type TierView } from "@peebee/shared";
import { BadgeCheck, Flag, Gift, Heart, Lock, MessageCircle, Send, Share2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { compactNumber, shareLink, timeAgo, ugx } from "../../lib/channels";
import { BottomDrawer } from "../BottomDrawer";

/** Avatar with initials when there is no picture. */
export function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold" style={{ width: size, height: size }} aria-hidden>{initials}</span>
  );
}

/** Who a post is from, with a link to their channel when they have one. */
export function PublisherLine({ post, dark = false }: { post: PostView; dark?: boolean }) {
  const p = post.publisher;
  if (!p) return null;
  const label = p.type === "channel" ? "Creator" : p.type === "store" ? "Store" : p.type === "restaurant" ? "Restaurant" : p.type === "learn" ? "School" : p.type === "driver" ? "Driver" : "";
  const body = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={p.name} url={p.avatarUrl} size={36} />
      <span className="min-w-0">
        <span className={`flex items-center gap-1 truncate text-sm font-semibold ${dark ? "text-white" : "text-ink"}`}>
          <span className="truncate">{p.name}</span>
          {p.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-gold" aria-label="Verified" />}
        </span>
        <span className={`block truncate text-[11px] ${dark ? "text-white/60" : "text-ink-500"}`}>
          {p.handle ? `@${p.handle}` : label}{post.publishedAt ? ` · ${timeAgo(post.publishedAt)}` : ""}
        </span>
      </span>
    </span>
  );
  return p.type === "channel" && p.handle ? <Link href={`/c/${p.handle}`} className="min-w-0">{body}</Link> : <span className="min-w-0">{body}</span>;
}

/** A post's poll. Results show once the viewer has voted. */
export function PollView({ post, onVoted, dark = false }: { post: PostView; onVoted: () => void; dark?: boolean }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const poll = post.poll;
  if (!poll) return null;
  const voted = poll.myVote !== null;
  async function vote(i: number) {
    if (!user || voted || busy) return;
    setBusy(true);
    try {
      await api.votePoll(post.id, i);
      onVoted();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2" data-no-drag>
      {poll.question && <p className={`text-base font-semibold ${dark ? "text-white" : "text-ink"}`}>{poll.question}</p>}
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        return (
          <button key={i} type="button" disabled={voted || busy || !user} onClick={() => vote(i)} aria-label={`${o.text}${voted ? `, ${pct}%` : ""}`}
            className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm font-medium transition active:scale-[0.99] ${dark ? "border-white/20 bg-white/10 text-white" : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink"} ${poll.myVote === i ? "!border-gold" : ""}`}>
            {voted && <span className="absolute inset-y-0 left-0 bg-gold/25" style={{ width: `${pct}%` }} aria-hidden />}
            <span className="relative flex justify-between gap-3"><span>{o.text}</span>{voted && <span>{pct}%</span>}</span>
          </button>
        );
      })}
      <p className={`text-xs ${dark ? "text-white/60" : "text-ink-500"}`}>{poll.total} vote{poll.total === 1 ? "" : "s"}{!user ? " · sign in to vote" : ""}</p>
    </div>
  );
}

/** Shown in place of locked content: what it takes to watch, and the button to do it. */
export function LockPanel({ post, onUnlocked, dark = false }: { post: PostView; onUnlocked: () => void; dark?: boolean }) {
  const { user } = useAuth();
  const lock = post.locked;
  const handle = post.publisher?.handle ?? null;
  const [tiers, setTiers] = useState<TierView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle || !user) return;
    api.publicChannel(handle).then((r) => setTiers(r.tiers)).catch(() => setTiers([]));
  }, [handle, user]);

  if (!lock) return null;
  const tone = dark ? "text-white" : "text-ink";
  const sub = dark ? "text-white/70" : "text-ink-500";

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onUnlocked();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 rounded-3xl p-5 text-center ${dark ? "bg-black/55 backdrop-blur-md" : "bg-[rgb(var(--surface-muted))]"}`} data-no-drag>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold"><Lock className="h-5 w-5" aria-hidden /></span>
      <p className={`text-base font-bold ${tone}`}>
        {lock.access === "members" ? "For members only" : `Unlock for ${ugx(lock.priceUgx)}`}
      </p>
      {!user ? (
        <>
          <p className={`text-sm ${sub}`}>Sign in to watch this.</p>
          <Link href="/login" className="rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Sign in</Link>
        </>
      ) : (
        <>
          {lock.access === "pay_per_view" && (
            <button type="button" disabled={busy !== null} onClick={() => run("ppv", () => api.unlockPost(post.id))} className="min-h-11 rounded-full bg-gold px-6 text-sm font-bold text-ink-gold disabled:opacity-60">
              {busy === "ppv" ? "Unlocking…" : `Unlock for ${ugx(lock.priceUgx)}`}
            </button>
          )}
          {tiers.map((t) => (
            <button key={t.id} type="button" disabled={busy !== null} onClick={() => run(t.id, () => api.subscribeToTier(t.id))} className={`min-h-11 rounded-full px-6 text-sm font-bold disabled:opacity-60 ${lock.access === "members" ? "bg-gold text-ink-gold" : dark ? "bg-white/15 text-white" : "bg-[rgb(var(--surface-card))] text-ink"}`}>
              {busy === t.id ? "Joining…" : `Join ${t.name} · ${ugx(t.priceUgx)}/${t.periodDays === 30 ? "month" : `${t.periodDays} days`}`}
            </button>
          ))}
          {lock.access === "members" && tiers.length === 0 && <p className={`text-sm ${sub}`}>Memberships are not open yet.</p>}
          <p className={`text-xs ${sub}`}>Paid from your Peebee wallet. <Link href="/wallet" className="font-semibold text-gold">Top up</Link></p>
        </>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-red-500">{error}</p>}
    </div>
  );
}

/** Like, comment, tip, share and report. */
export function PostActions({ post, config, onLike, onComments, onTip, onReport, liked, likeCount, commentCount, dark = false, vertical = false }: {
  post: PostView; config: ChannelsPublicConfig | null; onLike: () => void; onComments: () => void; onTip: () => void; onReport: () => void;
  liked: boolean; likeCount: number; commentCount: number; dark?: boolean; vertical?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const canTip = !!config?.monetization?.enabled && (config.monetization.tips || config.monetization.gifts) && post.publisher?.type === "channel" && !post.isMine;
  async function share() {
    const path = post.publisher?.type === "channel" && post.publisher.handle ? `/post/${post.id}` : `/post/${post.id}`;
    const r = await shareLink(post.caption.slice(0, 60) || "A post on Peebee", path);
    if (r === "copied") { setNote("Link copied"); setTimeout(() => setNote(null), 1800); }
  }
  const base = dark ? "bg-white/15 text-white" : "bg-[rgb(var(--surface-muted))] text-ink";
  const Btn = ({ label, count, active, onClick, children }: { label: string; count?: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={`flex items-center gap-1.5 transition active:scale-90 ${vertical ? "flex-col" : ""}`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${active ? "bg-red-600 text-white" : base}`}>{children}</span>
      {count !== undefined && <span className={`text-[11px] font-semibold ${dark ? "text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/.5)]" : "text-ink-500"}`}>{count}</span>}
    </button>
  );
  return (
    <div className={`flex ${vertical ? "flex-col items-center gap-5" : "items-center gap-4"}`} data-no-drag>
      {config?.publishing?.reactionsEnabled !== false && <Btn label={liked ? "Unlike" : "Like"} active={liked} count={compactNumber(likeCount)} onClick={onLike}><Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} aria-hidden /></Btn>}
      {config?.publishing?.commentsEnabled !== false && <Btn label="Comments" count={compactNumber(commentCount)} onClick={onComments}><MessageCircle className="h-5 w-5" aria-hidden /></Btn>}
      {canTip && <Btn label="Send a tip or gift" onClick={onTip}><Gift className="h-5 w-5" aria-hidden /></Btn>}
      <Btn label="Share" onClick={share}><Share2 className="h-[18px] w-[18px]" aria-hidden /></Btn>
      {!post.isMine && <Btn label="Report" onClick={onReport}><Flag className="h-[18px] w-[18px]" aria-hidden /></Btn>}
      {note && <span role="status" className={`text-xs font-semibold ${dark ? "text-white" : "text-ink"}`}>{note}</span>}
    </div>
  );
}

export function CommentsSheet({ post, open, onClose, onCountChange }: { post: PostView; open: boolean; onClose: () => void; onCountChange: (delta: number) => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Awaited<ReturnType<typeof api.postComments>>["comments"]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const load = useCallback(() => { api.postComments(post.id).then((r) => setComments(r.comments)).catch(() => setComments([])); }, [post.id]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.commentOnPost(post.id, text.trim());
      setText("");
      setHeld(r.held);
      if (!r.held) onCountChange(1);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <BottomDrawer isOpen={open} onClose={onClose} title={`Comments · ${post.counts.comments}`}>
      <div className="space-y-4">
        {comments.length === 0 && <p className="text-sm text-ink-500">No comments yet. Be the first.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author} url={null} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink-500">{c.author} · {timeAgo(c.createdAt)}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-ink">{c.body}</p>
            </div>
            {c.canDelete && <button type="button" aria-label="Delete comment" onClick={async () => { await api.deleteComment(c.id).catch(() => undefined); onCountChange(-1); load(); }} className="text-ink-500"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        {held && <p className="text-xs text-ink-500">Your comment is waiting for review.</p>}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="field-box flex min-w-0 flex-1 items-center rounded-full px-4">
              <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Add a comment…" aria-label="Add a comment" className="h-11 w-full text-sm text-ink outline-none" />
            </div>
            <button type="button" onClick={send} disabled={!text.trim() || busy} aria-label="Post comment" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink-gold disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        ) : <Link href="/login" className="block text-center text-sm font-semibold text-gold">Sign in to comment</Link>}
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </BottomDrawer>
  );
}

export function TipSheet({ channelId, channelName, postId, config, open, onClose }: { channelId: string; channelName: string; postId?: string; config: ChannelsPublicConfig | null; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(1000);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const m = config?.monetization;
  const gifts = m?.gifts ? parseGiftOptions(m.giftOptions) : [];
  async function send(key: string, input: { amountUgx?: number; gift?: string }) {
    setBusy(key);
    setMessage(null);
    try {
      await api.tipChannel(channelId, { ...input, postId });
      setMessage({ ok: true, text: `Sent to ${channelName}. Thank you!` });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }
  return (
    <BottomDrawer isOpen={open} onClose={onClose} title={`Support ${channelName}`}>
      <div className="space-y-5">
        {m?.tips && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Send a tip</p>
            <div className="flex flex-wrap gap-2">
              {[1000, 2000, 5000, 10000].filter((v) => v >= (m.minTipUgx ?? 0) && v <= (m.maxTipUgx ?? Infinity)).map((v) => (
                <button key={v} type="button" aria-pressed={amount === v} onClick={() => setAmount(v)} className={`rounded-full px-4 py-2 text-sm font-semibold ${amount === v ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>{ugx(v)}</button>
              ))}
            </div>
            <div className="field-box flex items-center rounded-2xl px-4">
              <input type="number" inputMode="numeric" min={m.minTipUgx} max={m.maxTipUgx} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Tip amount in UGX" className="h-12 w-full text-sm text-ink outline-none" />
            </div>
            <button type="button" disabled={busy !== null} onClick={() => send("tip", { amountUgx: amount })} className="min-h-11 w-full rounded-full bg-gold text-sm font-bold text-ink-gold disabled:opacity-60">{busy === "tip" ? "Sending…" : `Tip ${ugx(amount)}`}</button>
          </div>
        )}
        {gifts.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Or send a gift</p>
            <div className="grid grid-cols-3 gap-2">
              {gifts.map((g) => (
                <button key={g.name} type="button" disabled={busy !== null} onClick={() => send(g.name, { gift: g.name })} className="flex flex-col items-center gap-1 rounded-2xl bg-[rgb(var(--surface-muted))] px-2 py-3 text-ink disabled:opacity-60">
                  <Gift className="h-5 w-5 text-gold" aria-hidden />
                  <span className="text-sm font-semibold">{g.name}</span>
                  <span className="text-[11px] text-ink-500">{ugx(g.priceUgx)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-ink-500">Paid from your Peebee wallet. <Link href="/wallet" className="font-semibold text-gold">Top up</Link></p>
        {message && <p role="status" className={`text-sm font-semibold ${message.ok ? "text-green" : "text-red-600"}`}>{message.text}</p>}
      </div>
    </BottomDrawer>
  );
}

const REPORT_REASONS = ["Spam or scam", "Nudity or sexual content", "Violence or harm", "Hate or harassment", "False information", "Something else"];

export function ReportSheet({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function report(reason: string) {
    setError(null);
    try {
      await api.reportPost(postId, reason);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <BottomDrawer isOpen={open} onClose={() => { setDone(false); onClose(); }} title="Report this post">
      {done ? (
        <div className="space-y-3 text-center"><p className="text-sm text-ink">Thank you. Our team will take a look.</p><button type="button" onClick={() => { setDone(false); onClose(); }} className="min-h-11 rounded-full bg-gold px-6 text-sm font-bold text-ink-gold">Done</button></div>
      ) : !user ? (
        <Link href="/login" className="block text-center text-sm font-semibold text-gold">Sign in to report</Link>
      ) : (
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => <button key={r} type="button" onClick={() => report(r)} className="w-full rounded-2xl bg-[rgb(var(--surface-muted))] px-4 py-3 text-left text-sm font-medium text-ink">{r}</button>)}
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </BottomDrawer>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md"><X className="h-5 w-5" /></button>;
}
