"use client";

import type { VideoAssetView, VideoProviderOption } from "@peebee/shared";
import { CheckCircle2, Film, Link2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { uploadToProvider } from "../../lib/video-upload";
import { Button, Chip, Notice, TextField } from "./ui";

type Mode = "upload" | "bring";

/**
 * Adds a video to a post: upload it (to Peebee's provider, or to the creator's own account), or bring
 * one that already exists in their account or at a link. Peebee only ever takes the video: ads and
 * earnings from the provider never come with it.
 */
export function VideoPicker({ protectedPlayback, asset, onAsset }: { protectedPlayback: boolean; asset: VideoAssetView | null; onAsset: (a: VideoAssetView | null) => void }) {
  const [providers, setProviders] = useState<VideoProviderOption[] | null>(null);
  const [maxSeconds, setMaxSeconds] = useState(600);
  const [mode, setMode] = useState<Mode>("upload");
  const [choice, setChoice] = useState<string>("platform");
  const [bringProvider, setBringProvider] = useState<string>("link");
  const [reference, setReference] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.videoProviders().then((r) => { setProviders(r.providers); setMaxSeconds(r.maxDurationSeconds); }).catch((e) => setError(errorMessage(e))); }, []);

  // Wait for the provider to finish preparing the video.
  const poll = useCallback((id: string) => {
    const t = setInterval(async () => {
      try {
        const r = await api.videoAsset(id);
        onAsset(r.asset);
        if (r.asset.status === "ready" || r.asset.status === "failed") clearInterval(t);
      } catch { /* try again */ }
    }, 3000);
    return () => clearInterval(t);
  }, [onAsset]);
  useEffect(() => {
    if (asset && (asset.status === "uploading" || asset.status === "processing") && progress === null) return poll(asset.id);
  }, [asset, progress, poll]);

  const platformOk = providers?.some((p) => p.platform.available && p.supportsDirectUpload && (!protectedPlayback || p.supportsProtectedPlayback)) ?? false;
  const mine = (providers ?? []).filter((p) => p.byo.allowed && p.byo.connected && p.supportsDirectUpload && (!protectedPlayback || p.supportsProtectedPlayback));
  const bringable = (providers ?? []).filter((p) => p.byo.allowed && (p.key === "link" || p.byo.connected));
  const byoEnabled = (providers ?? []).some((p) => p.byo.allowed);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const source = choice === "platform" ? "platform" : "byo";
      const { asset: created, upload } = await api.startVideoUpload({ source, provider: source === "byo" ? (choice as never) : undefined, title: file.name.replace(/\.[^.]+$/, ""), protectedPlayback });
      onAsset(created);
      // The demo provider has nowhere to send a file, so skip the transfer.
      if (created.provider !== "mock") await uploadToProvider(file, upload, setProgress);
      setProgress(null);
      onAsset({ ...created, status: "processing" });
    } catch (err) {
      setProgress(null);
      setError(errorMessage(err));
      onAsset(null);
    } finally {
      setBusy(false);
    }
  }

  async function bring() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.importVideo({ provider: bringProvider as never, reference: reference.trim() });
      onAsset(r.asset);
      setReference("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (asset) {
    const notLocked = protectedPlayback && asset.visibility !== "protected";
    return (
      <div className="space-y-3 rounded-2xl bg-[rgb(var(--surface-muted))] p-4">
        <div className="flex items-center gap-3">
          {asset.status === "ready" ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green" aria-hidden /> : asset.status === "failed" ? <Film className="h-6 w-6 shrink-0 text-red-600" aria-hidden /> : <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{asset.title || "Your video"}</p>
            <p className="text-xs text-ink-500">{asset.status === "ready" ? `Ready${asset.durationSeconds ? ` · ${Math.floor(asset.durationSeconds / 60)}:${String(Math.round(asset.durationSeconds % 60)).padStart(2, "0")}` : ""}` : asset.status === "failed" ? asset.error ?? "This video could not be used." : progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : "Getting it ready…"}</p>
          </div>
          <button type="button" onClick={() => onAsset(null)} className="text-xs font-bold text-ink-500">Change</button>
        </div>
        {progress !== null && <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-card))]"><div className="h-full bg-gold transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
        {notLocked && <Notice tone="error">This video was added as public, so it cannot be locked. Change it and upload again with locking on.</Notice>}
      </div>
    );
  }

  if (providers && !platformOk && mine.length === 0 && !byoEnabled) {
    return <Notice tone="info">Video uploads are not available yet.</Notice>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Add a video">
        <Chip active={mode === "upload"} onClick={() => setMode("upload")}><Upload className="mr-1.5 inline h-4 w-4" aria-hidden />Upload</Chip>
        {byoEnabled && <Chip active={mode === "bring"} onClick={() => setMode("bring")}><Link2 className="mr-1.5 inline h-4 w-4" aria-hidden />Bring a video</Chip>}
      </div>
      {mode === "upload" && (
        <div className="space-y-3">
          {(platformOk ? 1 : 0) + mine.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {platformOk && <Chip active={choice === "platform"} onClick={() => setChoice("platform")}>Peebee</Chip>}
              {mine.map((p) => <Chip key={p.key} active={choice === p.key} onClick={() => setChoice(p.key)}>My {p.displayName}</Chip>)}
            </div>
          )}
          {!platformOk && mine.length > 0 && choice === "platform" && <p className="text-xs text-ink-500">Choose where to upload.</p>}
          <input ref={fileRef} type="file" accept="video/*" className="sr-only" aria-label="Choose a video file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy || (!platformOk && mine.length === 0)} className="w-full">{busy ? "Starting…" : "Choose a video"}</Button>
          <p className="text-xs text-ink-500">Up to {Math.floor(maxSeconds / 60)} minutes. {protectedPlayback ? "This video will be locked: only people allowed to watch can play it." : ""}</p>
          {!platformOk && mine.length === 0 && <Notice tone="info">{protectedPlayback ? "No provider that can lock videos is set up yet." : "No video provider is set up yet."}</Notice>}
        </div>
      )}
      {mode === "bring" && (
        <div className="space-y-3">
          <p className="text-xs text-ink-500">Bring a video you already have: paste its ID from your Cloudinary, Mux, Bunny or Cloudflare account, or the address of a video file. Only the video comes across. Peebee shows its own ads and the earnings are shared with you here.</p>
          <div className="flex flex-wrap gap-2">{bringable.map((p) => <Chip key={p.key} active={bringProvider === p.key} onClick={() => setBringProvider(p.key)}>{p.displayName}</Chip>)}</div>
          <TextField id="vp-ref" label={bringProvider === "link" ? "Video address (https)" : "Video ID or public ID"} value={reference} onChange={setReference} placeholder={bringProvider === "link" ? "https://…/video.mp4" : ""} />
          <Button onClick={bring} disabled={busy || !reference.trim()} className="w-full">{busy ? "Checking…" : "Add this video"}</Button>
          {(providers ?? []).some((p) => p.byo.allowed && !p.byo.connected && p.key !== "link") && <p className="text-xs text-ink-500">To bring from another account, connect it first in Profile.</p>}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
