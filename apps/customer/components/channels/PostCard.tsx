"use client";

import type { PostView } from "@peebee/shared";
import Link from "next/link";
import { useChannelsConfig } from "../../lib/channels";
import { CommentsSheet, PostActions, PublisherLine, ReportSheet, TipSheet } from "./PostParts";
import { PostMedia } from "./PostMedia";
import { usePost } from "./usePost";

/** A post in a list (a channel page, a single post page). The full-screen version lives in the Spotlight. */
export function PostCard({ post: initial, showStatus = false }: { post: PostView; showStatus?: boolean }) {
  const { config } = useChannelsConfig();
  const s = usePost(initial);
  const p = s.post;
  return (
    <article className="space-y-3 rounded-[28px] bg-[rgb(var(--surface-card))] p-4 shadow-sm" aria-label={p.caption.slice(0, 60) || "Post"}>
      <div className="flex items-center justify-between gap-3">
        <PublisherLine post={p} />
        {showStatus && p.status !== "published" && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold capitalize text-gold">{p.status}</span>}
        {p.access !== "free" && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold">{p.access === "members" ? "Members" : "Paid"}</span>}
      </div>
      <PostMedia post={p} muted={false} onChanged={s.replace} />
      {p.type !== "text" && p.caption && !p.locked && <p className="whitespace-pre-wrap break-words text-sm text-ink">{p.caption}</p>}
      {p.type !== "text" && p.caption && p.locked && <p className="text-sm text-ink-500">{p.caption}…</p>}
      {p.tags.length > 0 && <p className="text-xs text-gold">{p.tags.map((t) => `#${t}`).join(" ")}</p>}
      {p.removedReason && p.status === "removed" && <p className="text-xs text-red-600">Removed: {p.removedReason}</p>}
      {p.status === "published" && (
        <PostActions post={p} config={config} liked={s.liked} likeCount={s.likes} commentCount={s.comments}
          onLike={s.toggleLike} onComments={() => s.setSheet("comments")} onTip={() => s.setSheet("tip")} onReport={() => s.setSheet("report")} />
      )}
      <Link href={`/post/${p.id}`} className="sr-only">Open post</Link>
      <CommentsSheet post={p} open={s.sheet === "comments"} onClose={() => s.setSheet(null)} onCountChange={s.addComments} />
      {p.publisher?.type === "channel" && <TipSheet channelId={p.publisher.id} channelName={p.publisher.name} postId={p.id} config={config} open={s.sheet === "tip"} onClose={() => s.setSheet(null)} />}
      <ReportSheet postId={p.id} open={s.sheet === "report"} onClose={() => s.setSheet(null)} />
    </article>
  );
}
