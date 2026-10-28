/**
 * Minimal local stand-in for the R2Bucket Worker binding type, mirroring
 * db/client.ts's approach for D1: the binding only exists inside a Worker
 * (wrangler dev/deploy), so it's registered once per request from worker.ts
 * rather than imported at module-load time.
 */
export type R2Object = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  /** Whole-object size in bytes (present on real R2 bodies). */
  size?: number;
  /** The slice actually returned when a range was requested. */
  range?: { offset: number; length: number };
};

export type R2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string, options?: { range?: { offset: number; length?: number } }): Promise<R2Object | null>;
  /** Whether an object exists, without reading it. The real binding has it; small stand-ins may not. */
  head?(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
};

let r2Binding: R2Bucket | null = null;

/** Called once per request from worker.ts before any route handler runs. */
export function setR2Binding(binding: R2Bucket | undefined): void {
  r2Binding = binding ?? null;
}

/**
 * Headers for streaming a stored upload back to a client.
 *
 * The content type on these objects came from whoever uploaded the file —
 * it's checked against an allowlist at upload time, but the bytes behind it
 * were never verified to match. `nosniff` stops a browser second-guessing
 * that declaration and deciding to run an "image" as something executable,
 * which is the one way a stored file turns into a script.
 */
export function uploadResponseHeaders(contentType: string | undefined, fallback: string): Record<string, string> {
  return {
    "Content-Type": contentType ?? fallback,
    "X-Content-Type-Options": "nosniff",
    // Displayed in place, never handed to the OS as a download to open.
    "Content-Disposition": "inline",
  };
}

export function getR2Bucket(): R2Bucket {
  if (!r2Binding) {
    throw new Error(
      "No R2 binding registered (RIDER_DOCS) — file uploads require running inside the Worker (wrangler dev/deploy), not local Node dev.",
    );
  }
  return r2Binding;
}

/** Whether private file storage is connected in this runtime (the Worker binding exists). */
export function r2IsReady(): boolean {
  return r2Binding !== null;
}
