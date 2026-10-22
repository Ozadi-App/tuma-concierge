"use client";

import type { VideoProviderOption } from "@peebee/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "../../../components/channels/PostParts";
import { OpenChannel } from "../../../components/studio/OpenChannel";
import { Button, Card, Notice, TextArea, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { api, errorMessage } from "../../../lib/api";
import { uploadPicture } from "../../../lib/channels";

function VideoAccounts() {
  const [providers, setProviders] = useState<VideoProviderOption[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => { api.videoProviders().then((r) => setProviders(r.providers.filter((p) => p.byo.allowed && p.byo.needsAccount))).catch(() => setProviders([])); };
  useEffect(load, []);
  if (!providers || providers.length === 0) return null;
  return (
    <Card title="Your video accounts" hint="Already host videos on Cloudinary, Mux, Bunny or Cloudflare? Connect the account to upload there or bring videos into Peebee. Only the video comes across: Peebee shows its own ads and you earn your share here.">
      {providers.map((p) => (
        <div key={p.key} className="space-y-3 rounded-2xl bg-[rgb(var(--surface-muted))] p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-ink">{p.displayName}</p><p className="text-xs text-ink-500">{p.byo.connected ? "Connected" : "Not connected"}</p></div>
            {p.byo.connected && <button type="button" aria-label={`Disconnect ${p.displayName}`} onClick={async () => { if (window.confirm(`Disconnect ${p.displayName}? Videos already added keep working.`)) { await api.disconnectVideoAccount(p.key).catch(() => undefined); load(); } }} className="text-ink-500"><Trash2 className="h-4 w-4" /></button>}
            <Button variant="plain" onClick={() => { setOpen(open === p.key ? null : p.key); setValues({}); setMsg(null); }} className="!min-h-10 !px-4 !text-xs">{open === p.key ? "Close" : p.byo.connected ? "Update keys" : "Connect"}</Button>
          </div>
          {open === p.key && (
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMsg(null);
              try {
                await api.connectVideoAccount(p.key, Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())));
                setMsg({ ok: true, text: "Connected. The keys work." });
                setOpen(null);
                load();
              } catch (err) {
                setMsg({ ok: false, text: errorMessage(err) });
              } finally {
                setBusy(false);
              }
            }}>
              <p className="text-xs text-ink-500">Your keys are checked with {p.displayName}, then stored encrypted. Peebee never shows them again.</p>
              {p.byo.fields.map((f) => (
                <TextField key={f.key} id={`va-${p.key}-${f.key}`} label={`${f.label}${f.set ? " (saved)" : ""}`} type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} placeholder={f.set ? "Leave blank to keep" : f.placeholder} hint={f.helpText} required={f.required && !f.set} />
              ))}
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Checking…" : "Save and check"}</Button>
            </form>
          )}
        </div>
      ))}
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
    </Card>
  );
}

export default function ProfilePage() {
  const { channel, config, loading, reload } = useMyChannel();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!channel) return;
    setDisplayName(channel.displayName); setHandle(channel.handle); setBio(channel.bio); setCategory(channel.category ?? "");
    setAvatarUrl(channel.avatarUrl); setBannerUrl(channel.bannerUrl); setLinks(channel.links);
  }, [channel]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!channel) return config ? <OpenChannel config={config} onOpened={reload} /> : null;

  async function pick(kind: "avatar" | "banner", file: File | undefined) {
    if (!file) return;
    try {
      const up = await uploadPicture(file);
      if (kind === "avatar") { setAvatar(up.path); setAvatarUrl(up.url); } else { setBanner(up.path); setBannerUrl(up.url); }
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.updateMyChannel({ displayName, handle, bio, category, links: links.filter((l) => l.url.trim()), ...(avatar ? { avatarPath: avatar } : {}), ...(banner ? { bannerPath: banner } : {}) });
      setMsg({ ok: true, text: "Saved." });
      await reload();
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Profile</h1>
      <form onSubmit={save}>
        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={displayName || "?"} url={avatarUrl} size={72} />
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-bold text-ink">Change picture<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick("avatar", e.target.files?.[0])} /></label>
              <label className="cursor-pointer rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2 text-xs font-bold text-ink">{bannerUrl ? "Change banner" : "Add a banner"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick("banner", e.target.files?.[0])} /></label>
            </div>
          </div>
          {bannerUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={bannerUrl} alt="Banner" className="h-24 w-full rounded-2xl object-cover" />}
          <TextField id="pf-name" label="Channel name" value={displayName} onChange={setDisplayName} maxLength={60} required />
          <TextField id="pf-handle" label="Handle" value={handle} onChange={(v) => setHandle(v.toLowerCase().replace(/[^a-z0-9._]/g, ""))} maxLength={config?.handle?.max ?? 30} hint={`peebee.online/c/${handle}`} />
          <TextArea id="pf-bio" label="About" value={bio} onChange={setBio} rows={3} maxLength={config?.maxBioChars ?? 300} />
          <TextField id="pf-cat" label="Category (optional)" value={category} onChange={setCategory} maxLength={40} placeholder="Cooking, music, farming…" />
          {(config?.maxLinks ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-ink-500">Links</p>
              {links.map((l, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-2"><TextField id={`pf-l${i}`} label="Address (https)" value={l.url} onChange={(v) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, url: v } : x)))} placeholder="https://…" /></div>
                  <button type="button" aria-label="Remove link" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))} className="mb-3 text-ink-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {links.length < (config?.maxLinks ?? 0) && <Button variant="plain" onClick={() => setLinks((p) => [...p, { label: "", url: "" }])} className="!min-h-10 !text-xs"><Plus className="mr-1 inline h-4 w-4" aria-hidden />Add a link</Button>}
            </div>
          )}
          {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save profile"}</Button>
        </Card>
      </form>
      <VideoAccounts />
    </div>
  );
}
