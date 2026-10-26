import { parseWordList } from "@peebee/shared";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getPlatformEnvironment } from "../lib/settings.js";
import { parsePublicHttpsUrl } from "../video/url-guard.js";
import { absUrl, ChannelsError, parseJson, requireChannels, type Row } from "./common.js";
import { ownMediaPath } from "./media.js";

export type ChannelRow = Row & { id: string; owner_id: string; handle: string; display_name: string; status: string };

/** Lower-case, no leading @, only letters, digits, dots and underscores, and not starting or ending with a symbol. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function checkHandle(handle: string, cfg: Awaited<ReturnType<typeof requireChannels>>): string | null {
  if (handle.length < cfg.general.handleMinLength) return `Handles need at least ${cfg.general.handleMinLength} characters.`;
  if (handle.length > cfg.general.handleMaxLength) return `Handles can be up to ${cfg.general.handleMaxLength} characters.`;
  if (!/^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/.test(handle) || handle.includes("..") || handle.includes("__")) {
    return "Use letters, numbers, dots and underscores. Start and end with a letter or number.";
  }
  if (/^\d+$/.test(handle)) return "A handle cannot be only numbers.";
  const reserved = parseWordList(cfg.general.reservedHandles);
  if (reserved.some((w) => handle === w || handle.replace(/[._]/g, "") === w.replace(/[._]/g, ""))) return "That handle is reserved.";
  return null;
}

export async function handleTaken(handle: string, exceptChannelId?: string): Promise<boolean> {
  const res = await db.execute({ sql: "SELECT id FROM channels WHERE handle = ?", args: [handle] });
  const row = res.rows[0] as Row | undefined;
  return !!row && String(row.id) !== exceptChannelId;
}

export async function getChannelByHandle(handle: string): Promise<ChannelRow | null> {
  const res = await db.execute({ sql: "SELECT * FROM channels WHERE handle = ?", args: [normalizeHandle(handle)] });
  return (res.rows[0] as unknown as ChannelRow | undefined) ?? null;
}

export async function getChannelById(id: string): Promise<ChannelRow | null> {
  const res = await db.execute({ sql: "SELECT * FROM channels WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as ChannelRow | undefined) ?? null;
}

export async function getMyChannel(userId: string): Promise<ChannelRow | null> {
  const env = await getPlatformEnvironment();
  const res = await db.execute({ sql: "SELECT * FROM channels WHERE owner_id = ? AND environment = ?", args: [userId, env] });
  return (res.rows[0] as unknown as ChannelRow | undefined) ?? null;
}

function cleanLinks(raw: unknown, max: number): Array<{ label: string; url: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ label: string; url: string }> = [];
  for (const item of raw.slice(0, max)) {
    const url = parsePublicHttpsUrl(String((item as Row)?.url ?? ""));
    if (!url) throw new ChannelsError("invalid_link", "Links must be public https addresses.", 400);
    out.push({ label: String((item as Row)?.label ?? url.hostname).slice(0, 40), url: url.toString() });
  }
  return out;
}

export type OpenChannelInput = {
  handle: string;
  displayName: string;
  bio?: string;
  category?: string;
  avatarPath?: string | null;
  bannerPath?: string | null;
  links?: unknown;
  ageConfirmed?: boolean;
};

/** Opens a channel for an account, or converts it into one. No ID is asked for: that only happens at withdrawal. */
export async function openChannel(userId: string, input: OpenChannelInput): Promise<ChannelRow> {
  const cfg = await requireChannels();
  if (!cfg.general.channelsOpen) throw new ChannelsError("channels_closed", "New channels are not being opened right now.", 403);
  if (await getMyChannel(userId)) throw new ChannelsError("already_has_channel", "You already have a channel.", 409);
  if (cfg.general.ageDeclarationRequired && cfg.general.minAge > 0 && !input.ageConfirmed) {
    throw new ChannelsError("age_declaration_required", `Please confirm you are at least ${cfg.general.minAge} years old.`, 400);
  }
  const handle = normalizeHandle(input.handle);
  const problem = checkHandle(handle, cfg);
  if (problem) throw new ChannelsError("invalid_handle", problem, 400);
  if (await handleTaken(handle)) throw new ChannelsError("handle_taken", "That handle is taken.", 409);
  const displayName = input.displayName.trim().slice(0, 60);
  if (!displayName) throw new ChannelsError("name_required", "Give your channel a name.", 400);

  const id = newId("chn");
  try {
    await db.execute({
      sql: `INSERT INTO channels (id, owner_id, handle, display_name, bio, avatar_url, banner_url, category, links_json, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, userId, handle, displayName, (input.bio ?? "").trim().slice(0, cfg.general.maxBioChars) || null,
        ownMediaPath(input.avatarPath), ownMediaPath(input.bannerPath), input.category?.trim().slice(0, 40) || null,
        JSON.stringify(cleanLinks(input.links, cfg.general.maxLinks)), await getPlatformEnvironment(),
      ],
    });
  } catch (err) {
    // Two people racing for one handle: the unique index decides.
    if (await handleTaken(handle)) throw new ChannelsError("handle_taken", "That handle is taken.", 409);
    throw err;
  }
  return (await getChannelById(id))!;
}

export async function updateChannel(userId: string, input: Partial<OpenChannelInput>): Promise<ChannelRow> {
  const cfg = await requireChannels();
  const ch = await getMyChannel(userId);
  if (!ch) throw new ChannelsError("no_channel", "You do not have a channel yet.", 404);
  if (ch.status !== "active") throw new ChannelsError("channel_suspended", "This channel is suspended.", 403);

  const sets: string[] = [];
  const args: Array<string | number | null> = [];
  if (input.handle !== undefined) {
    const handle = normalizeHandle(input.handle);
    if (handle !== ch.handle) {
      const problem = checkHandle(handle, cfg);
      if (problem) throw new ChannelsError("invalid_handle", problem, 400);
      if (cfg.general.handleChangeDays > 0 && ch.handle_changed_at) {
        const next = new Date(`${String(ch.handle_changed_at).replace(" ", "T")}Z`).getTime() + cfg.general.handleChangeDays * 86_400_000;
        if (Date.now() < next) throw new ChannelsError("handle_cooldown", `You can change your handle again on ${new Date(next).toDateString()}.`, 429);
      }
      if (await handleTaken(handle, ch.id)) throw new ChannelsError("handle_taken", "That handle is taken.", 409);
      sets.push("handle = ?", "handle_changed_at = datetime('now')");
      args.push(handle);
    }
  }
  if (input.displayName !== undefined) {
    const name = input.displayName.trim().slice(0, 60);
    if (!name) throw new ChannelsError("name_required", "Give your channel a name.", 400);
    sets.push("display_name = ?");
    args.push(name);
  }
  if (input.bio !== undefined) { sets.push("bio = ?"); args.push(input.bio.trim().slice(0, cfg.general.maxBioChars) || null); }
  if (input.category !== undefined) { sets.push("category = ?"); args.push(input.category.trim().slice(0, 40) || null); }
  if (input.avatarPath !== undefined) { sets.push("avatar_url = ?"); args.push(ownMediaPath(input.avatarPath)); }
  if (input.bannerPath !== undefined) { sets.push("banner_url = ?"); args.push(ownMediaPath(input.bannerPath)); }
  if (input.links !== undefined) { sets.push("links_json = ?"); args.push(JSON.stringify(cleanLinks(input.links, cfg.general.maxLinks))); }
  if (sets.length) {
    await db.execute({ sql: `UPDATE channels SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`, args: [...args, ch.id] });
  }
  return (await getChannelById(ch.id))!;
}

export async function postCount(channelId: string): Promise<number> {
  const res = await db.execute({ sql: "SELECT COUNT(*) AS n FROM posts WHERE publisher_type = 'channel' AND publisher_id = ? AND status = 'published' AND to_channel = 1", args: [channelId] });
  return Number((res.rows[0] as Row).n);
}

export async function serializeChannel(ch: Row, origin: string, viewerId: string | null) {
  const following = viewerId
    ? !!(await db.execute({ sql: "SELECT 1 FROM channel_follows WHERE channel_id = ? AND user_id = ?", args: [ch.id as string, viewerId] })).rows[0]
    : false;
  return {
    id: ch.id as string,
    handle: ch.handle as string,
    displayName: ch.display_name as string,
    bio: (ch.bio as string) ?? "",
    avatarUrl: absUrl(origin, ch.avatar_url),
    bannerUrl: absUrl(origin, ch.banner_url),
    category: (ch.category as string) ?? null,
    links: parseJson<Array<{ label: string; url: string }>>(ch.links_json, []),
    verified: Number(ch.verified_badge) === 1,
    status: ch.status as string,
    followerCount: Number(ch.follower_count ?? 0),
    postCount: await postCount(ch.id as string),
    createdAt: ch.created_at as string,
    isOwner: viewerId !== null && ch.owner_id === viewerId,
    isFollowing: following,
  };
}

export async function follow(userId: string, channelId: string): Promise<void> {
  await requireChannels();
  const ch = await getChannelById(channelId);
  if (!ch || ch.status !== "active") throw new ChannelsError("not_found", "Channel not found.", 404);
  if (ch.owner_id === userId) throw new ChannelsError("own_channel", "You cannot follow your own channel.", 400);
  const res = await db.execute({ sql: "INSERT OR IGNORE INTO channel_follows (channel_id, user_id) VALUES (?, ?)", args: [channelId, userId] });
  if (res.rowsAffected) await db.execute({ sql: "UPDATE channels SET follower_count = follower_count + 1 WHERE id = ?", args: [channelId] });
}

export async function unfollow(userId: string, channelId: string): Promise<void> {
  const res = await db.execute({ sql: "DELETE FROM channel_follows WHERE channel_id = ? AND user_id = ?", args: [channelId, userId] });
  if (res.rowsAffected) await db.execute({ sql: "UPDATE channels SET follower_count = MAX(0, follower_count - 1) WHERE id = ?", args: [channelId] });
}

export async function followedChannelIds(userId: string): Promise<Set<string>> {
  const res = await db.execute({ sql: "SELECT channel_id FROM channel_follows WHERE user_id = ?", args: [userId] });
  return new Set((res.rows as Row[]).map((r) => String(r.channel_id)));
}
