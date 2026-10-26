"use client";

import type { PostView } from "@peebee/shared";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { LiveCommentInput, LiveCommentList } from "./LiveChat";
import { useLiveFeed } from "./useLiveFeed";

/** How many are watching, drawn under the LIVE badge. */
export function LiveViewerBadge({ feed }: { feed: ReturnType<typeof useLiveFeed> }) {
  const s = feed.state;
  if (!s) return null;
  if (s.status === "ended") return <span className="absolute left-3 top-12 z-20 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">Stream ended</span>;
  if (s.viewers === null) return null;
  return (
    <span className="absolute left-3 top-12 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
      <Eye className="h-3 w-3" aria-hidden /> {s.viewers.toLocaleString()} watching
    </span>
  );
}

/** Comments and the box to write one, for someone watching a live post. */
export function LiveViewerChat({ post, feed }: { post: PostView; feed: ReturnType<typeof useLiveFeed> }) {
  const { user } = useAuth();
  const s = feed.state;
  if (!s || s.status === "ended" || !s.commentsEnabled) return null;
  return (
    <div className="space-y-2">
      <LiveCommentList comments={feed.comments} pinned={s.pinned} canModerate={s.canModerate} streamId={s.id} max={5} />
      {user
        ? <LiveCommentInput streamId={post.id} maxChars={s.maxCommentChars} onSent={feed.refresh} />
        : <Link href="/login" className="inline-block rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white">Sign in to comment</Link>}
    </div>
  );
}
