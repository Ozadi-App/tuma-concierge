"use client";

import type { PostStatus, PostView } from "@peebee/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Chip, Notice } from "../../../components/studio/ui";
import { api, errorMessage } from "../../../lib/api";
import { compactNumber, timeAgo, ugx } from "../../../lib/channels";

const FILTERS: Array<{ id: PostStatus | "all"; label: string }> = [
  { id: "all", label: "All" }, { id: "published", label: "Published" }, { id: "draft", label: "Drafts" }, { id: "scheduled", label: "Scheduled" }, { id: "review", label: "In review" }, { id: "removed", label: "Removed" },
];

export default function MyPostsPage() {
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.myPosts(filter === "all" ? undefined : filter).then((r) => setPosts(r.posts)).catch((e) => setError(errorMessage(e)));
  }, [filter]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Your posts</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map((f) => <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}</div>
      {error && <Notice tone="error">{error}</Notice>}
      {posts?.length === 0 && <p className="rounded-2xl bg-[rgb(var(--surface-muted))] p-6 text-center text-sm text-ink-500">Nothing here yet. <Link href="/studio/new" className="font-bold text-gold">Create a post</Link></p>}
      {posts?.map((p) => (
        <div key={p.id} className="space-y-2 rounded-3xl bg-[rgb(var(--surface-card))] p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {p.media.coverUrl || p.media.images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={(p.media.coverUrl ?? p.media.images[0]) as string} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--surface-muted))] text-xs font-bold capitalize text-ink-500">{p.type}</span>}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-sm font-semibold text-ink">{p.caption || <em className="font-normal text-ink-500">No caption</em>}</p>
              <p className="mt-1 text-xs text-ink-500">
                {p.status === "published" ? `${compactNumber(p.counts.views)} views · ${compactNumber(p.counts.likes)} likes · ${compactNumber(p.counts.comments)} comments · ${timeAgo(p.publishedAt)}` : p.status === "scheduled" && p.scheduledAt ? `Goes live ${new Date(`${p.scheduledAt.replace(" ", "T")}Z`).toLocaleString()}` : `Saved ${timeAgo(p.createdAt)} ago`}
                {p.access !== "free" ? ` · ${p.access === "members" ? "Members" : ugx(p.priceUgx)}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold capitalize text-gold">{p.status}</span>
          </div>
          {p.removedReason && p.status === "removed" && <p className="text-xs text-red-600">{p.removedReason}</p>}
          {p.status === "review" && <p className="text-xs text-ink-500">Waiting for Peebee to check it. It will show as soon as it is approved.</p>}
          <div className="flex flex-wrap gap-2">
            {p.status === "published" && <Link href={`/post/${p.id}`} className="rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-bold text-ink">View</Link>}
            {(p.status === "draft" || p.status === "scheduled") && <Button disabled={busy === p.id} onClick={() => act(p.id, () => api.publishPost(p.id))} className="!min-h-10 !px-4 !text-xs">{p.status === "scheduled" ? "Post now" : "Post"}</Button>}
            {p.status !== "removed" && <Button variant="danger" disabled={busy === p.id} onClick={() => { if (window.confirm("Delete this post?")) void act(p.id, () => api.deletePost(p.id)); }} className="!min-h-10 !px-4 !text-xs">Delete</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}
