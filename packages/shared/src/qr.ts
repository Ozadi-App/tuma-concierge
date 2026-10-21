/**
 * One QR implementation for every app: draw a code from the `qrcode` library (so it is a standards-correct QR that any
 * phone reads) and read one from a camera frame with jsQR (so scanning works on iPhones, Firefox and desktops, where the
 * browser's own BarcodeDetector does not exist). Import from "@peebee/shared/qr".
 */
import jsQR from "jsqr";
import QRCode from "qrcode";

/** The dark/light modules of a QR for `text` (true = dark), error correction M. */
export function qrModules(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const rows: boolean[][] = [];
  for (let r = 0; r < modules.size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < modules.size; c++) row.push(modules.get(r, c) === 1);
    rows.push(row);
  }
  return rows;
}

/** The QR for `text` as an SVG path (one square per dark module) inside a square of `size` units, with the 4-module quiet zone the standard asks for. */
export function qrSvg(text: string): { size: number; path: string } {
  const modules = qrModules(text);
  const quiet = 4;
  const path = modules.flatMap((row, r) => row.map((dark, c) => (dark ? `M${c + quiet} ${r + quiet}h1v1h-1z` : ""))).join("");
  return { size: modules.length + quiet * 2, path };
}

/** Decodes a QR from raw RGBA pixels. Returns the text, or null when there is no readable code in the frame. */
export function decodeQrPixels(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Decodes the QR in the current frame of a playing video, using `canvas` as scratch space. */
export function decodeQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  // A smaller frame decodes much faster and is plenty for a phone held at arm's length.
  const scale = Math.min(1, 640 / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);
  return decodeQrPixels(ctx.getImageData(0, 0, cw, ch).data, cw, ch);
}

/**
 * What a scan means as a code. QR codes here carry the plain code (a PIN, ticket, voucher or outlet code), but a link
 * ending in one (".../verify/RCP-123" or "?code=123456") is accepted too, so a printed or shared QR still works.
 */
export function codeFromScan(raw: string): string {
  const text = raw.trim();
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get("code") ?? url.searchParams.get("ref");
    if (fromQuery) return fromQuery.trim();
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last).trim();
  } catch {
    // Not a link: it is the code itself.
  }
  return text;
}

export type QrCameraHandle = { stop: () => void };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };

/**
 * Opens the back camera in `video` and calls `onValue` once with the first QR it reads. Uses the browser's own
 * BarcodeDetector where there is one and jsQR on every other phone and browser, so it works everywhere a camera does.
 * Rejects when there is no camera or permission is refused; the caller then offers typing the code instead.
 */
export async function startQrCamera(video: HTMLVideoElement, onValue: (text: string) => void): Promise<QrCameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("no_camera");
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play().catch(() => undefined);

  const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
  const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
  const canvas = document.createElement("canvas");
  let done = false;
  const timer = window.setInterval(async () => {
    if (done || video.readyState < 2) return;
    let value: string | null = null;
    if (detector) {
      try { value = (await detector.detect(video))[0]?.rawValue ?? null; } catch { /* fall back to jsQR for this frame */ }
    }
    if (!value) value = decodeQrFromVideo(video, canvas);
    if (value && !done) {
      done = true;
      onValue(value.trim());
    }
  }, 250);
  return {
    stop() {
      done = true;
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}
