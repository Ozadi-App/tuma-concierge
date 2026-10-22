"use client";

import type { VideoUploadInstructions } from "@peebee/shared";

/**
 * Sends a video file straight to the provider that will keep it (never through Peebee), the way that
 * provider asks: a form post, a plain PUT, or a resumable (tus) upload. Reports progress as 0 to 1.
 */
export async function uploadToProvider(file: File, upload: VideoUploadInstructions, onProgress: (fraction: number) => void): Promise<void> {
  if (upload.protocol === "tus") {
    const { Upload } = await import("tus-js-client");
    await new Promise<void>((resolve, reject) => {
      const u = new Upload(file, {
        endpoint: upload.uploadUrl,
        headers: upload.headers ?? {},
        retryDelays: [0, 3000, 5000, 10000],
        chunkSize: 8 * 1024 * 1024,
        metadata: { filetype: file.type || "video/mp4", title: file.name },
        onProgress: (sent, total) => onProgress(total ? sent / total : 0),
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
      u.start();
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.uploadUrl);
    if (upload.protocol === "raw") for (const [k, v] of Object.entries(upload.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload was refused (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload could not be completed. Check your connection and try again."));
    if (upload.protocol === "form") {
      const form = new FormData();
      for (const [k, v] of Object.entries(upload.fields ?? {})) form.set(k, v);
      form.set("file", file);
      xhr.send(form);
    } else {
      xhr.send(file);
    }
  });
}
