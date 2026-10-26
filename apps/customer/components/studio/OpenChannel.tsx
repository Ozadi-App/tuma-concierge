"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@peebee/shared";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { uploadPicture } from "../../lib/channels";
import { Avatar } from "../channels/PostParts";
import { Button, Card, Notice, TextArea, TextField } from "./ui";
import type { ChannelsPublicConfig } from "@peebee/shared";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);

/** Opens a channel, or converts the account into one. Nothing here asks for ID: that only happens when you withdraw money. */
export function OpenChannel({ config, onOpened }: { config: ChannelsPublicConfig; onOpened: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [handle, setHandle] = useState("");
  const [touched, setTouched] = useState(false);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<{ path: string; url: string } | null>(null);
  const [age, setAge] = useState(false);
  const [check, setCheck] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!touched) setHandle(slug(displayName)); }, [displayName, touched]);
  useEffect(() => {
    if (handle.length < 2) { setCheck(null); return; }
    const t = setTimeout(() => { api.channelHandleAvailable(handle).then(setCheck).catch(() => setCheck(null)); }, 350);
    return () => clearTimeout(t);
  }, [handle]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { channel } = await api.openChannel({ handle, displayName, bio, avatarPath: avatar?.path ?? null, ageConfirmed: age });
      onOpened();
      // Straight to the new channel, so the person sees what they just made.
      router.push(`/c/${channel.handle}`);
      return;
    } catch (err) {
      // A second tap, or a slow first one: the channel already exists, so go to it instead of showing an error.
      if (err instanceof ApiError && err.code === "already_has_channel") {
        try {
          const mine = await api.myChannel();
          if (mine.channel) { onOpened(); router.push(`/c/${mine.channel.handle}`); return; }
        } catch { /* fall through to the message */ }
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (config.channelsOpen === false) return <Notice tone="info">New channels are not being opened right now.</Notice>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold text-ink">Start your channel</h1>
        <p className="text-sm text-ink-500">Post videos, pictures and more, grow followers, and earn. It is free, and no ID is needed to start.</p>
      </div>
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={displayName || "?"} url={avatar?.url ?? null} size={64} />
          <label className="cursor-pointer rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2.5 text-sm font-bold text-ink">
            {avatar ? "Change picture" : "Add a picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setAvatar(await uploadPicture(f)); } catch (err) { setError(errorMessage(err)); } } }} />
          </label>
        </div>
        <TextField id="oc-name" label="Channel name" value={displayName} onChange={setDisplayName} maxLength={60} required />
        <div>
          <TextField id="oc-handle" label="Handle" value={handle} onChange={(v) => { setTouched(true); setHandle(v.toLowerCase().replace(/[^a-z0-9._]/g, "")); }} maxLength={config.handle?.max ?? 30} required hint={`peebee.online/c/${handle || "yourname"}`} />
          {check && <p role="status" className={`mt-1 text-xs font-semibold ${check.available ? "text-green" : "text-red-600"}`}>{check.available ? "Available" : check.reason ?? "Taken"}</p>}
        </div>
        <TextArea id="oc-bio" label="About you (optional)" value={bio} onChange={setBio} rows={3} maxLength={config.maxBioChars ?? 300} />
        {config.ageDeclarationRequired && (config.minAge ?? 0) > 0 && (
          <label className="flex items-start gap-3 text-sm text-ink"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-5 w-5" /> I confirm I am at least {config.minAge} years old.</label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy || !displayName.trim() || handle.length < 2 || (check !== null && !check.available) || (config.ageDeclarationRequired === true && (config.minAge ?? 0) > 0 && !age)} className="w-full">{busy ? "Opening…" : "Open my channel"}</Button>
      </Card>
    </form>
  );
}
