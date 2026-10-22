"use client";

import type { PostView } from "@peebee/shared";
import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

/** A post's local state: likes and counts update at once, and a post can be refreshed after it is unlocked. */
export function usePost(initial: PostView) {
  const { user } = useAuth();
  const [post, setPost] = useState(initial);
  const [liked, setLiked] = useState(initial.liked);
  const [likes, setLikes] = useState(initial.counts.likes);
  const [comments, setComments] = useState(initial.counts.comments);
  const [sheet, setSheet] = useState<null | "comments" | "tip" | "report">(null);

  const toggleLike = useCallback(async () => {
    if (!user) { window.location.href = "/login"; return; }
    const was = liked;
    setLiked(!was);
    setLikes((n) => Math.max(0, n + (was ? -1 : 1)));
    try {
      const r = await api.likePost(post.id);
      setLiked(r.liked);
      setLikes(r.likeCount);
    } catch {
      setLiked(was);
      setLikes((n) => Math.max(0, n + (was ? 1 : -1)));
    }
  }, [liked, post.id, user]);

  const replace = useCallback((next?: PostView) => {
    if (!next) return;
    setPost(next);
    setLiked(next.liked);
    setLikes(next.counts.likes);
    setComments(next.counts.comments);
  }, []);

  return { post, liked, likes, comments, sheet, setSheet, toggleLike, replace, addComments: (d: number) => setComments((n) => Math.max(0, n + d)) };
}
