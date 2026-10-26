import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { consume } from "../lib/ratelimit.js";
import { entitlement } from "./access.js";
import { ChannelsError, requireChannels, type Row } from "./common.js";
import { containsBlockedWord, getPost, type PostRow } from "./posts.js";

async function visiblePost(postId: string): Promise<PostRow> {
  const post = await getPost(postId);
  if (!post || post.status !== "published") throw new ChannelsError("not_found", "Post not found.", 404);
  return post;
}

export async function toggleLike(userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const cfg = await requireChannels();
  if (!cfg.publishing.reactionsEnabled) throw new ChannelsError("likes_off", "Likes are turned off.", 400);
  const post = await visiblePost(postId);
  const removed = await db.execute({ sql: "DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?", args: [postId, userId] });
  if (removed.rowsAffected) {
    await db.execute({ sql: "UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?", args: [postId] });
    return { liked: false, likeCount: Math.max(0, Number(post.like_count) - 1) };
  }
  const added = await db.execute({ sql: "INSERT OR IGNORE INTO post_reactions (post_id, user_id) VALUES (?, ?)", args: [postId, userId] });
  if (added.rowsAffected) await db.execute({ sql: "UPDATE posts SET like_count = like_count + 1 WHERE id = ?", args: [postId] });
  return { liked: true, likeCount: Number(post.like_count) + (added.rowsAffected ? 1 : 0) };
}

export async function addComment(userId: string, postId: string, body: string) {
  const cfg = await requireChannels();
  if (!cfg.publishing.commentsEnabled) throw new ChannelsError("comments_off", "Comments are turned off.", 400);
  const post = await visiblePost(postId);
  const text = body.trim();
  if (!text) throw new ChannelsError("empty_comment", "Write a comment.", 400);
  if (text.length > cfg.publishing.maxCommentChars) throw new ChannelsError("comment_too_long", `Comments can be up to ${cfg.publishing.maxCommentChars} characters.`, 400);
  const ent = await entitlement(post as never, userId, cfg);
  if (!ent.allowed) throw new ChannelsError("locked", "Unlock this post to comment.", 403);
  const limit = await consume(`comment:${userId}`, cfg.publishing.commentsPerHour, 3600);
  if (!limit.allowed) throw new ChannelsError("rate_limited", "You are commenting too fast. Try again shortly.", 429);

  const held = containsBlockedWord(text, cfg);
  const id = newId("cmt");
  await db.execute({ sql: "INSERT INTO post_comments (id, post_id, user_id, body, status) VALUES (?, ?, ?, ?, ?)", args: [id, postId, userId, text, held ? "hidden" : "visible"] });
  if (!held) await db.execute({ sql: "UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?", args: [postId] });
  return { id, held };
}

export async function listComments(postId: string, viewerId: string | null, cursor = 0, pageSize = 20) {
  const cfg = await requireChannels();
  const post = await visiblePost(postId);
  const ent = await entitlement(post as never, viewerId, cfg);
  if (!ent.allowed) return { comments: [], nextCursor: null };
  const rows = (await db.execute({
    sql: `SELECT c.id, c.body, c.user_id, c.created_at, u.name FROM post_comments c JOIN users u ON u.id = c.user_id
          WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    args: [postId, pageSize + 1, cursor],
  })).rows as Row[];
  return {
    comments: rows.slice(0, pageSize).map((r) => ({
      id: String(r.id), body: String(r.body), author: String(r.name ?? "Peebee user").split(" ")[0], createdAt: String(r.created_at),
      mine: viewerId === r.user_id, canDelete: viewerId === r.user_id || viewerId === post.author_id,
    })),
    nextCursor: rows.length > pageSize ? cursor + pageSize : null,
  };
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const c = (await db.execute({ sql: "SELECT c.*, p.author_id AS post_author FROM post_comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?", args: [commentId] })).rows[0] as Row | undefined;
  if (!c || (c.user_id !== userId && c.post_author !== userId)) throw new ChannelsError("not_found", "Comment not found.", 404);
  const res = await db.execute({ sql: "UPDATE post_comments SET status = 'hidden' WHERE id = ? AND status = 'visible'", args: [commentId] });
  if (res.rowsAffected) await db.execute({ sql: "UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?", args: [c.post_id as string] });
}

export async function reportPost(userId: string, postId: string, reason: string, details?: string): Promise<void> {
  const cfg = await requireChannels();
  const post = await visiblePost(postId);
  if (post.author_id === userId) throw new ChannelsError("own_post", "This is your own post.", 400);
  const cleanReason = reason.trim().slice(0, 60);
  if (!cleanReason) throw new ChannelsError("reason_required", "Choose a reason.", 400);
  const limit = await consume(`post-report:${userId}`, cfg.moderation.reportsPerDay, 86_400);
  if (!limit.allowed) throw new ChannelsError("rate_limited", "You have sent a lot of reports today. Try again tomorrow.", 429);
  const added = await db.execute({ sql: "INSERT OR IGNORE INTO post_reports (id, post_id, reporter_id, reason, details) VALUES (?, ?, ?, ?, ?)", args: [newId("rpt"), postId, userId, cleanReason, details?.trim().slice(0, 500) || null] });
  if (!added.rowsAffected) return;
  await db.execute({ sql: "UPDATE posts SET report_count = report_count + 1 WHERE id = ?", args: [postId] });
  if (cfg.moderation.autoHideAtReports > 0) {
    await db.execute({ sql: "UPDATE posts SET status = 'review', updated_at = datetime('now') WHERE id = ? AND status = 'published' AND report_count >= ?", args: [postId, cfg.moderation.autoHideAtReports] });
  }
}

export async function votePoll(userId: string, postId: string, optionIndex: number): Promise<void> {
  await requireChannels();
  const post = await visiblePost(postId);
  const poll = post.poll_json ? (JSON.parse(String(post.poll_json)) as { options: string[] }) : null;
  if (!poll) throw new ChannelsError("no_poll", "This post has no poll.", 400);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) throw new ChannelsError("invalid_option", "Choose one of the options.", 400);
  await db.execute({ sql: "INSERT OR IGNORE INTO post_poll_votes (post_id, user_id, option_index) VALUES (?, ?, ?)", args: [postId, userId, optionIndex] });
}
