"use client";

import React, { useMemo } from "react";

// GF(256) tables with primitive polynomial 0x11D (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
})();

function gMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(data.length + ecCount);
  remainder.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = remainder[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        remainder[i + j] ^= gMul(gen[j], coef);
      }
    }
  }
  return remainder.slice(data.length);
}

// Generate Version 2 QR Code (25x25) with Error Correction M (16 data bytes, 16 EC bytes)
function buildQrMatrix(text: string): boolean[][] {
  const size = 25; // Version 2
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  function setFinder(startR: number, startC: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startR + r;
        const col = startC + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          if (isBorder) {
            matrix[row][col] = false;
          } else {
            const isInner = r >= 1 && r <= 5 && c >= 1 && c <= 5;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[row][col] = isInner ? isCenter : true;
          }
        }
      }
    }
  }

  // 1. Finder patterns
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // 2. Alignment pattern at (18, 18) for Version 2
  const alignR = 18;
  const alignC = 18;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isEdge = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      matrix[alignR + r][alignC + c] = isEdge || isCenter;
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // 4. Dark module at (size - 8, 8) -> (17, 8)
  matrix[size - 8][8] = true;

  // 5. Reserve format info
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 6. Encode Data (Byte Mode 0100, Version 2 max capacity: 16 data bytes for EC Level M)
  const bytes = new TextEncoder().encode(text.slice(0, 14));
  const bitBuf: number[] = [];

  // Mode: 0100 (byte mode)
  bitBuf.push(0, 1, 0, 0);
  // Count: 8 bits
  for (let i = 7; i >= 0; i--) bitBuf.push((bytes.length >> i) & 1);
  // Data bytes
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bitBuf.push((b >> i) & 1);
  }
  // Terminator
  for (let i = 0; i < 4 && bitBuf.length < 16 * 8; i++) bitBuf.push(0);
  // Pad to byte
  while (bitBuf.length % 8 !== 0) bitBuf.push(0);
  // Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bitBuf.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bitBuf[i + j];
    dataBytes.push(byte);
  }
  // Pad bytes 0xEC, 0x11 up to 16 bytes (V2-M total data codewords)
  const pad = [0xec, 0x11];
  let pIdx = 0;
  while (dataBytes.length < 16) {
    dataBytes.push(pad[pIdx % 2]);
    pIdx++;
  }

  // 7. Error Correction (16 EC bytes for V2-M)
  const ecBytes = rsCompute(new Uint8Array(dataBytes), 16);

  // Combine data + ec
  const allCodewords = [...dataBytes, ...ecBytes];
  const allBits: number[] = [];
  for (const byte of allCodewords) {
    for (let i = 7; i >= 0; i--) allBits.push((byte >> i) & 1);
  }

  // 8. Place data bits in matrix (right-to-left, zig-zag)
  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (matrix[r][c] === null) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply mask pattern 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit === 1) !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 9. Format bits: EC Level M (00), Mask 0 (000) -> 00000 -> BCH format 101010000010010
  // Masked with 101010000010010 ^ 101010000010010 = 000000000000000 (standard mask XOR)
  // Let's use precomputed format bits for (EC M, Mask 0): 0b101010000010010 ^ 0b101010000010010 = 0
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatMask = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const maskedFormat = formatBits.map((b, i) => b ^ formatMask[i]);

  // Place format info around top-left, top-right, and bottom-left
  // Top-left
  matrix[8][0] = maskedFormat[0] === 1;
  matrix[8][1] = maskedFormat[1] === 1;
  matrix[8][2] = maskedFormat[2] === 1;
  matrix[8][3] = maskedFormat[3] === 1;
  matrix[8][4] = maskedFormat[4] === 1;
  matrix[8][5] = maskedFormat[5] === 1;
  matrix[8][7] = maskedFormat[6] === 1;
  matrix[8][8] = maskedFormat[7] === 1;
  matrix[7][8] = maskedFormat[8] === 1;
  matrix[5][8] = maskedFormat[9] === 1;
  matrix[4][8] = maskedFormat[10] === 1;
  matrix[3][8] = maskedFormat[11] === 1;
  matrix[2][8] = maskedFormat[12] === 1;
  matrix[1][8] = maskedFormat[13] === 1;
  matrix[0][8] = maskedFormat[14] === 1;

  // Split between bottom-left and top-right
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = maskedFormat[i] === 1;
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = maskedFormat[7 + i] === 1;
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}

export function FuelQrCode({
  value,
  size = 200,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const matrix = useMemo(() => {
    try {
      return buildQrMatrix(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-2xl bg-zinc-100 text-xs text-zinc-500"
      >
        Invalid QR Data
      </div>
    );
  }

  const moduleCount = matrix.length;
  const padding = 2; // quiet zone
  const viewBoxSize = moduleCount + padding * 2;

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={`rounded-2xl bg-white p-2.5 shadow-sm ${className}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + padding}
              y={r + padding}
              width={1}
              height={1}
              fill="#0A0A0A"
            />
          ) : null
        )
      )}
    </svg>
  );
}
