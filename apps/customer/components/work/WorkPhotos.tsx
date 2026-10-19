"use client";

import type { WorkPhoto, WorkPublicSettings } from "@peebee/shared";
import { Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { compressImage } from "../../lib/image-compress";
import { cardClass, Notice, primaryBtn } from "./WorkUI";
import { workFailure } from "./work-utils";

const PHASE_LABEL: Record<WorkPhoto["phase"], string> = { request: "From you", before: "Before", after: "After" };

function Thumb({ photo }: { photo: WorkPhoto }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    api
      .workPhotoBlob(photo.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo.id]);
  return (
    <figure className="space-y-1">
      <div className="aspect-square overflow-hidden rounded-2xl bg-[rgb(var(--surface-muted))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={photo.note || `${PHASE_LABEL[photo.phase]} photo`} className="h-full w-full object-cover" /> : null}
      </div>
      <figcaption className="text-[10px] font-bold text-ink-500">
        {PHASE_LABEL[photo.phase]}
        {photo.note ? ` · ${photo.note}` : ""}
      </figcaption>
    </figure>
  );
}

/** Photos on a job: shows everyone's, and lets the customer add photos of what needs doing while the job is live. */
export function WorkPhotos({ jobId, settings, canAdd, prompt }: { jobId: string; settings: WorkPublicSettings; canAdd: boolean; prompt?: boolean }) {
  const [photos, setPhotos] = useState<WorkPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof workFailure> | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const max = settings.maxPhotosPerJob;

  const load = useCallback(() => api.workJobPhotos(jobId).then((r) => setPhotos(r.photos)).catch(() => setPhotos((p) => p ?? [])), [jobId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setLocalError(null);
    try {
      const small = await compressImage(file, { maxDimension: 1600, quality: 0.8 });
      if (settings.maxPhotoKb && small.size > settings.maxPhotoKb * 1024) {
        setLocalError(`That photo is too large. Photos can be up to ${Math.round((settings.maxPhotoKb / 1024) * 10) / 10} MB. Try a smaller one.`);
        return;
      }
      await api.workUploadJobPhoto(jobId, small);
      await load();
    } catch (err) {
      setError(workFailure(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (!photos) return null;
  const full = max != null && max > 0 && photos.length >= max;
  if (photos.length === 0 && !canAdd) return null;

  return (
    <section className={`${cardClass} space-y-3`} aria-labelledby="photos-heading">
      <h2 id="photos-heading" className="text-xs font-bold uppercase tracking-wider">
        Photos
      </h2>
      {prompt && photos.length === 0 && canAdd ? <p className="text-sm text-ink-500">Photos of what needs doing help your provider prepare and quote accurately.</p> : null}
      <Notice text={localError ?? undefined} />
      <Notice failure={error} />
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <Thumb key={p.id} photo={p} />
          ))}
        </div>
      ) : null}
      {canAdd ? (
        <>
          <button type="button" disabled={busy || full} onClick={() => input.current?.click()} className={primaryBtn}>
            <Camera className="h-5 w-5" aria-hidden />
            {busy ? "Uploading..." : full ? "Photo limit reached" : "Add a photo"}
          </button>
          <p className="text-xs text-ink-500">
            {photos.length}
            {max ? ` of ${max}` : ""} photos added.
          </p>
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Choose a photo" onChange={(e) => void pick(e.target.files?.[0])} />
        </>
      ) : null}
    </section>
  );
}
