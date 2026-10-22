"use client";

import { Megaphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage, getStoredToken } from "../../lib/api";
import { compressImage } from "../../lib/image-compress";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000").replace(/\/$/, "");

/**
 * A driver shares something with everyone in the Spotlight: a picture or a few words. Same shared
 * post model as every other publisher. Not available during a trip or delivery (the safety rule is
 * enforced by the server, with an Admin switch).
 */
export default function DriverSpotlightPost() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [caption, setCaption] = useState("");
  const [picture, setPicture] = useState<{ path: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.channelsConfig().then((c) => setEnabled(c.enabled && !!c.publishing?.publishers.includes("driver"))).catch(() => setEnabled(false));
  }, []);

  async function pickPicture(file?: File) {
    if (!file) return;
    setMessage(null);
    try {
      const small = await compressImage(file).catch(() => file);
      const form = new FormData();
      form.set("file", small);
      const res = await fetch(`${API_BASE}/v1/channels/media`, { method: "POST", headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` }, body: form });
      const body = (await res.json().catch(() => ({}))) as { path?: string; url?: string; message?: string };
      if (!res.ok || !body.path) throw new Error(body.message ?? "That picture could not be uploaded.");
      setPicture({ path: body.path, url: body.url ?? `${API_BASE}${body.path}` });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const me = await api.myChannel();
      const driver = me.identities.find((i) => i.type === "driver");
      if (!driver) throw new Error("Posting is not available for your account.");
      await api.createPost({ publisherType: "driver", publisherId: driver.id, type: picture ? "image" : "text", caption: caption.trim() || undefined, images: picture ? [picture.path] : undefined, publish: true });
      setCaption("");
      setPicture(null);
      setMessage({ ok: true, text: "Posted. It may take a moment to show if it needs a quick check." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null) return <div className="p-8 text-center text-sm text-ink-500" aria-busy="true">Loading…</div>;
  if (!enabled) {
    return <div className="space-y-3 px-6 py-16 text-center"><Megaphone className="mx-auto h-10 w-10 text-gold" aria-hidden /><h1 className="text-lg font-bold text-ink">Spotlight is not open for drivers yet</h1><Link href="/account" className="inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink-gold">Back to account</Link></div>;
  }
  return (
    <form onSubmit={post} className="space-y-4 px-4 pb-24 pt-4">
      <h1 className="text-xl font-extrabold text-ink">Share in the Spotlight</h1>
      <p className="text-sm text-ink-500">Show customers who you are: a picture of your day, a thank-you, or a short note. You post as a Peebee driver. You cannot post during a trip or delivery.</p>
      {picture && /* eslint-disable-next-line @next/next/no-img-element */ <img src={picture.url} alt="Your picture" className="aspect-square w-full rounded-3xl object-cover" />}
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] px-5 text-sm font-bold text-ink">{picture ? "Change picture" : "Add a picture"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void pickPicture(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <label className="block text-xs font-bold text-ink-500">What do you want to say?
        <span className="field-box mt-1 flex rounded-2xl px-4 py-3"><textarea value={caption} rows={4} maxLength={500} onChange={(e) => setCaption(e.target.value)} className="w-full resize-none text-base font-normal text-ink outline-none" /></span>
      </label>
      {message && <p role={message.ok ? "status" : "alert"} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
      <button type="submit" disabled={busy || (!picture && !caption.trim())} className="min-h-12 w-full rounded-full bg-gold text-sm font-bold text-ink-gold disabled:opacity-50">{busy ? "Posting…" : "Post"}</button>
    </form>
  );
}
