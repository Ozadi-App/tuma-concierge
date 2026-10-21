import assert from "node:assert/strict";
import test from "node:test";
import { codeFromScan, decodeQrPixels, qrModules, qrSvg } from "@peebee/shared/qr";

/** Paints a module grid as RGBA pixels the way a phone camera frame would see it. */
function paint(modules: boolean[][], opts: { scale?: number; quiet?: number; invert?: boolean } = {}) {
  const { scale = 6, quiet = 4, invert = false } = opts;
  const n = modules.length + quiet * 2;
  const width = n * scale;
  const [dark, light] = invert ? [255, 0] : [0, 255];
  const px = new Uint8ClampedArray(width * width * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = px[i + 1] = px[i + 2] = light; px[i + 3] = 255; }
  modules.forEach((row, r) => row.forEach((on, c) => {
    if (!on) return;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + quiet) * scale + y) * width + (c + quiet) * scale + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = dark;
    }
  }));
  return { px, width };
}
const read = (text: string, opts?: Parameters<typeof paint>[1]) => {
  const { px, width } = paint(qrModules(text), opts);
  return decodeQrPixels(px, width, width);
};

// Every kind of code the apps show as a QR: delivery PINs, fuel and relay codes, taxi tickets, receipts, merchant codes.
const PAYLOADS = ["695015", "2468", "A7K2P9", "FUEL-7K2P9A", "PEEBEE-DEMO", "mpay_9f3c1d2e", "RCP-GAS-MH3K9Z-4821", "UBP 631T", "https://app.peebee.online/receipt/RCP-GAS-MH3K9Z-4821"];

test("every code the apps put in a QR reads back exactly", () => {
  for (const text of PAYLOADS) assert.equal(read(text), text, text);
});

test("a QR still reads on a dark screen (light on dark), small on screen, and with a short quiet zone", () => {
  assert.equal(read("695015", { invert: true }), "695015");
  assert.equal(read("695015", { scale: 3 }), "695015");
  assert.equal(read("A7K2P9", { quiet: 2 }), "A7K2P9");
});

test("the SVG the apps draw is the same QR: parsed back into pixels it reads", () => {
  for (const text of ["695015", "FUEL-7K2P9A", "RCP-GAS-MH3K9Z-4821"]) {
    const { size, path } = qrSvg(text);
    const scale = 6;
    const width = size * scale;
    const px = new Uint8ClampedArray(width * width * 4).fill(255);
    for (const m of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
      const [x0, y0] = [Number(m[1]), Number(m[2])];
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const i = ((y0 * scale + y) * width + x0 * scale + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }
    assert.equal(decodeQrPixels(px, width, width), text, text);
  }
});

test("a blank frame or a frame with no code reads as nothing", () => {
  const blank = new Uint8ClampedArray(200 * 200 * 4).fill(255);
  assert.equal(decodeQrPixels(blank, 200, 200), null);
});

test("a scan means the code, whether the QR holds the plain code or a link ending in it", () => {
  assert.equal(codeFromScan(" 695015 "), "695015");
  assert.equal(codeFromScan("https://app.peebee.online/receipt/RCP-GAS-MH3K9Z-4821"), "RCP-GAS-MH3K9Z-4821");
  assert.equal(codeFromScan("https://app.peebee.online/c?code=482913"), "482913");
  assert.equal(codeFromScan("UBP 631T"), "UBP 631T");
});
