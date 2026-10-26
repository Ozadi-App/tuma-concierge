"use client";

import type { PostType, PublisherView, TierView, VideoAssetView } from "@peebee/shared";
import { AlignLeft, AudioLines, Film, Images, Image as ImageIcon, Radio, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OpenChannel } from "../../../components/studio/OpenChannel";
import { Button, Card, Chip, Notice, TextArea, TextField } from "../../../components/studio/ui";
import { useMyChannel } from "../../../components/studio/useMyChannel";
import { VideoPicker } from "../../../components/studio/VideoPicker";
import { api, errorMessage } from "../../../lib/api";
import { ugx, uploadAudio, uploadPicture } from "../../../lib/channels";

const TYPE_META: Record<PostType, { label: string; icon: typeof Film }> = {
  video: { label: "Video", icon: Film }, image: { label: "Picture", icon: ImageIcon }, carousel: { label: "Carousel", icon: Images },
  text: { label: "Text & poll", icon: AlignLeft }, audio: { label: "Audio", icon: AudioLines }, live: { label: "Live", icon: Radio },
};

const KIND_LABEL: Record<string, string> = { channel: "My channel", personal: "Me", store: "Store", restaurant: "Restaurant", learn: "School", driver: "Driver" };

export default function NewPostPage() {
  const router = useRouter();
  const { channel, config, identities, loading, reload } = useMyChannel();
  const [identityKey, setIdentityKey] = useState<string>("");
  const [type, setType] = useState<PostType>("image");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<Array<{ path: string; url: string }>>([]);
  const [audio, setAudio] = useState<{ path: string; url: string; name: string } | null>(null);
  const [video, setVideo] = useState<VideoAssetView | null>(null);
  const [cover, setCover] = useState<{ path: string; url: string } | null>(null);
  const [pollOn, setPollOn] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [access, setAccess] = useState<"free" | "members" | "pay_per_view">("free");
  const [price, setPrice] = useState(2000);
  const [preview, setPreview] = useState(15);
  const [minTier, setMinTier] = useState("");
  const [tiers, setTiers] = useState<TierView[]>([]);
  const [toChannel, setToChannel] = useState(true);
  const [toSpotlight, setToSpotlight] = useState(true);
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pub = config?.publishing;
  const usable: PublisherView[] = useMemo(
    () => identities.filter((i) => (i.type === "personal" ? pub?.personalPosting : pub?.publishers.includes(i.type))),
    [identities, pub],
  );
  const identity = usable.find((i) => `${i.type}:${i.id}` === identityKey) ?? usable[0] ?? null;
  const isChannel = identity?.type === "channel";
  // Going live is its own screen (the camera, no stream links), so it is not one of the post forms.
  const allowedTypes: PostType[] = ((pub?.postTypes ?? []) as PostType[]).filter((t) => t !== "live");
  const money = config?.monetization;
  const canLock = isChannel && !!money?.enabled && (money.memberships || money.payPerView) && type !== "live";

  useEffect(() => { if (usable.length && !identityKey) setIdentityKey(`${usable[0]!.type}:${usable[0]!.id}`); }, [usable, identityKey]);
  useEffect(() => { if (allowedTypes.length && !allowedTypes.includes(type)) setType(allowedTypes[0]!); }, [allowedTypes, type]);
  useEffect(() => { if (isChannel && money?.memberships) api.myTiers().then((r) => setTiers(r.tiers.filter((t) => t.active !== false))).catch(() => undefined); }, [isChannel, money?.memberships]);
  useEffect(() => { if (!isChannel) { setAccess("free"); setToChannel(false); } else setToChannel(true); }, [isChannel]);

  if (loading) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!config) return null;
  // A plain account can post as a personal profile; a channel is the upgrade.
  if (!channel && usable.length === 0) return <OpenChannel config={config} onOpened={reload} />;
  if (!identity) return <Notice tone="info">Posting is not available for you right now.</Notice>;

  const tagList = tags.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
  const pollOk = !pollOn || pollOptions.filter((o) => o.trim()).length >= 2;
  const mediaOk =
    type === "video" ? !!video && video.status !== "failed" && (access === "free" || video.visibility === "protected")
    : type === "image" ? images.length === 1
    : type === "carousel" ? images.length >= 2
    : type === "audio" ? !!audio
    : caption.trim().length > 0 || (pollOn && pollOk);
  const priceOk = access !== "pay_per_view" || (money && price >= money.minPayPerViewUgx && price <= money.maxPayPerViewUgx);
  const scheduleOk = !schedule || (scheduledAt !== "" && new Date(scheduledAt).getTime() > Date.now());

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    try {
      const room = type === "image" ? 1 : (pub?.maxCarouselImages ?? 10);
      const picked: Array<{ path: string; url: string }> = [];
      for (const f of Array.from(files).slice(0, room)) picked.push(await uploadPicture(f));
      setImages((prev) => (type === "image" ? picked.slice(0, 1) : [...prev, ...picked].slice(0, room)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submit(publish: boolean) {
    if (!identity) return;
    setBusy(publish ? "publish" : "draft");
    setError(null);
    try {
      const { post } = await api.createPost({
        publisherType: identity.type,
        publisherId: identity.id,
        type,
        caption: caption.trim() || undefined,
        tags: tagList,
        images: type === "image" || type === "carousel" ? images.map((i) => i.path) : undefined,
        audioPath: type === "audio" ? audio?.path : undefined,
        videoAssetId: type === "video" ? video?.id : undefined,
        coverPath: cover?.path ?? null,
        poll: type === "text" && pollOn ? { question: pollQuestion.trim() || undefined, options: pollOptions.map((o) => o.trim()).filter(Boolean) } : null,
        access: canLock ? access : "free",
        priceUgx: access === "pay_per_view" ? price : undefined,
        previewSeconds: type === "video" && access !== "free" ? preview : undefined,
        minTierId: access === "members" && minTier ? minTier : null,
        toChannel: isChannel ? toChannel : false,
        toSpotlight,
        publish,
        scheduledAt: publish && schedule ? new Date(scheduledAt).toISOString() : null,
      });
      router.push(post.status === "published" ? `/post/${post.id}` : "/studio/posts");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-ink">Create a post</h1>

      {config.live?.enabled && (
        <Link href="/live" className="flex items-center gap-4 rounded-[28px] bg-red-600 p-5 text-white shadow-sm transition active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20"><Radio className="h-6 w-6" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-base font-extrabold">Go live now</span><span className="block text-xs font-medium text-white/85">Use your phone camera. No links, no extra app.</span></span>
        </Link>
      )}

      {usable.length > 1 && (
        <Card title="Post as">
          <div className="flex flex-wrap gap-2">
            {usable.map((i) => <Chip key={`${i.type}:${i.id}`} active={`${i.type}:${i.id}` === `${identity.type}:${identity.id}`} onClick={() => setIdentityKey(`${i.type}:${i.id}`)}>{KIND_LABEL[i.type]}: {i.name}</Chip>)}
          </div>
        </Card>
      )}
      {!channel && <Notice tone="info">You are posting as yourself. <Link href="/studio" className="font-bold underline">Open a channel</Link> to get followers, memberships and earnings.</Notice>}

      <Card title="What are you posting?">
        <div className="grid grid-cols-3 gap-2">
          {allowedTypes.map((t) => {
            const Icon = TYPE_META[t].icon;
            return (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); setImages([]); }} className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-bold transition ${type === t ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink"}`}>
                <Icon className="h-5 w-5" aria-hidden /> {TYPE_META[t].label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={TYPE_META[type].label}>
        {type === "video" && <VideoPicker protectedPlayback={canLock && access !== "free"} asset={video} onAsset={setVideo} />}
        {(type === "image" || type === "carousel") && (
          <div className="space-y-3">
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((im, i) => (
                  <div key={im.path} className="relative aspect-square overflow-hidden rounded-2xl bg-[rgb(var(--surface-muted))]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt={`Picture ${i + 1}`} className="h-full w-full object-cover" />
                    <button type="button" aria-label={`Remove picture ${i + 1}`} onClick={() => setImages((prev) => prev.filter((x) => x.path !== im.path))} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] px-5 text-sm font-bold text-ink">
              {type === "image" ? (images.length ? "Choose a different picture" : "Choose a picture") : `Add pictures (${images.length}/${pub?.maxCarouselImages ?? 10})`}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple={type === "carousel"} className="sr-only" onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }} />
            </label>
            {type === "carousel" && images.length < 2 && <p className="text-xs text-ink-500">A carousel needs at least 2 pictures.</p>}
          </div>
        )}
        {type === "audio" && (
          <div className="space-y-3">
            {audio && <p className="text-sm font-semibold text-ink">{audio.name}</p>}
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] px-5 text-sm font-bold text-ink">
              {audio ? "Choose a different file" : "Choose an audio file"}
              <input type="file" accept="audio/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setError(null); setAudio({ ...(await uploadAudio(f)), name: f.name }); } catch (err) { setError(errorMessage(err)); } e.target.value = ""; }} />
            </label>
            <p className="text-xs text-ink-500">Up to {pub?.maxAudioMb ?? 25} MB.</p>
          </div>
        )}
        {type === "text" && (
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={pollOn} onChange={(e) => setPollOn(e.target.checked)} className="h-5 w-5" /> Add a poll</label>
            {pollOn && (
              <div className="space-y-2">
                <TextField id="np-q" label="Question" value={pollQuestion} onChange={setPollQuestion} maxLength={200} />
                {pollOptions.map((o, i) => <TextField key={i} id={`np-o${i}`} label={`Option ${i + 1}`} value={o} onChange={(v) => setPollOptions((prev) => prev.map((x, j) => (j === i ? v : x)))} maxLength={80} />)}
                {pollOptions.length < (pub?.maxPollOptions ?? 4) && <Button variant="plain" onClick={() => setPollOptions((p) => [...p, ""])}>Add an option</Button>}
              </div>
            )}
          </div>
        )}
        <TextArea id="np-caption" label={type === "text" ? "Your message" : "Caption (optional)"} value={caption} onChange={setCaption} maxLength={pub?.maxCaptionChars ?? 2200} rows={type === "text" ? 6 : 3} />
        <TextField id="np-tags" label="Tags (optional)" value={tags} onChange={setTags} placeholder="cooking, kampala" hint="Separate with spaces or commas" />
        {(type === "video" || type === "audio") && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-ink-500">Cover picture (optional)</p>
            <div className="flex items-center gap-3">
              {cover && /* eslint-disable-next-line @next/next/no-img-element */ <img src={cover.url} alt="Cover" className="h-14 w-14 rounded-xl object-cover" />}
              <label className="cursor-pointer rounded-full bg-[rgb(var(--surface-muted))] px-4 py-2.5 text-sm font-bold text-ink">{cover ? "Change" : "Add a cover"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setCover(await uploadPicture(f)); } catch (err) { setError(errorMessage(err)); } } }} /></label>
            </div>
          </div>
        )}
      </Card>

      {canLock && (
        <Card title="Who can watch?" hint="Locked posts are protected on the server, not just hidden in the app.">
          <div className="flex flex-wrap gap-2">
            <Chip active={access === "free"} onClick={() => setAccess("free")}>Everyone</Chip>
            {money?.memberships && <Chip active={access === "members"} onClick={() => setAccess("members")}>Members</Chip>}
            {money?.payPerView && <Chip active={access === "pay_per_view"} onClick={() => setAccess("pay_per_view")}>Pay per view</Chip>}
          </div>
          {access === "pay_per_view" && <TextField id="np-price" label={`Price (UGX ${money!.minPayPerViewUgx.toLocaleString()} to ${money!.maxPayPerViewUgx.toLocaleString()})`} type="number" inputMode="numeric" value={price} onChange={(v) => setPrice(Number(v))} />}
          {access === "members" && (
            tiers.length === 0
              ? <Notice tone="info">Create a membership tier first. <Link href="/studio/members" className="font-bold underline">Set up memberships</Link></Notice>
              : <label className="block text-xs font-bold text-ink-500">Lowest tier that can watch
                  <span className="field-box border border-[var(--border-faint)] mt-1 flex items-center rounded-2xl px-4"><select value={minTier} onChange={(e) => setMinTier(e.target.value)} className="h-12 w-full text-base font-normal text-ink outline-none"><option value="">Any member</option>{tiers.map((t) => <option key={t.id} value={t.id}>{t.name} · {ugx(t.priceUgx)}</option>)}</select></span>
                </label>
          )}
          {access !== "free" && type === "video" && (money?.maxPreviewSeconds ?? 0) > 0 && (
            <TextField id="np-preview" label={`Free preview (0 to ${money!.maxPreviewSeconds} seconds)`} type="number" inputMode="numeric" value={preview} onChange={(v) => setPreview(Math.max(0, Math.min(money!.maxPreviewSeconds, Number(v))))} hint="Viewers watch this much before being asked to unlock." />
          )}
        </Card>
      )}

      <Card title="Where should it show?">
        {isChannel && <label className="flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={toChannel} onChange={(e) => setToChannel(e.target.checked)} className="h-5 w-5" /> On my channel page</label>}
        <label className="flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={toSpotlight} onChange={(e) => setToSpotlight(e.target.checked)} className="h-5 w-5" /> In the Spotlight</label>
        {pub?.schedulingEnabled && (
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-ink"><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-5 w-5" /> Schedule for later</label>
            {schedule && <TextField id="np-when" label="Publish at" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} />}
          </div>
        )}
        {config.moderationMode === "before" && <p className="text-xs text-ink-500">New posts are checked by Peebee before they show.</p>}
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="sticky bottom-3 z-20 flex gap-2 rounded-full bg-[rgb(var(--surface-card))] p-2 shadow-[var(--shadow-float-capsule)]">
        <Button variant="plain" disabled={busy !== null || !mediaOk} onClick={() => submit(false)} className="flex-1">{busy === "draft" ? "Saving…" : "Save draft"}</Button>
        <Button disabled={busy !== null || !mediaOk || !pollOk || !priceOk || !scheduleOk || (type === "video" && video?.status !== "ready" && !schedule)} onClick={() => submit(true)} className="flex-[1.4]">{busy === "publish" ? "Posting…" : schedule ? "Schedule" : "Post"}</Button>
      </div>
      {type === "video" && video && video.status !== "ready" && video.status !== "failed" && <p className="text-center text-xs text-ink-500">You can post as soon as your video is ready, or save a draft now.</p>}
    </div>
  );
}
