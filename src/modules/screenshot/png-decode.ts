/**
 * Minimal PNG reader, built on Node's own `zlib` so screenshot comparison needs no image
 * dependency (see the blast-radius rule in CONTRIBUTING).
 *
 * Scope is deliberately narrow: 8-bit, non-interlaced, grayscale/RGB/grayscale+alpha/RGBA — which is
 * what every capture path in this extension produces (the VM-service and adb captures are both
 * 8-bit RGBA). Anything else returns undefined rather than guessing, and the caller treats "cannot
 * read it" as "cannot compare it", which is always the safe direction: a capture is kept.
 *
 * Nothing here decodes a full image into a bitmap the caller keeps. `pngGrayGrid` samples straight
 * into a small fixed grid, so peak memory is one inflated scanline buffer, not width × height × 4.
 */

import * as zlib from 'node:zlib';

/** Highest defined scanline filter type (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth). */
const FILTER_MAX = 4;

/** PNG signature — the eight bytes every PNG starts with. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Channel count per PNG color type; undefined for the types this reader does not handle. */
const CHANNELS: Record<number, number | undefined> = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** What the header says about an image, once it is one this reader can actually read. */
interface PngHeader {
    readonly width: number;
    readonly height: number;
    readonly channels: number;
}

/** Read the IHDR and confirm the image is in the supported subset. */
function readHeader(bytes: Buffer): PngHeader | undefined {
    if (bytes.length < 33) { return undefined; }
    for (let i = 0; i < SIGNATURE.length; i++) {
        if (bytes[i] !== SIGNATURE[i]) { return undefined; }
    }
    // IHDR is required to be the first chunk, so its fields sit at fixed offsets.
    if (bytes.toString('latin1', 12, 16) !== 'IHDR') { return undefined; }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const bitDepth = bytes[24];
    const channels = CHANNELS[bytes[25]];
    const interlace = bytes[28];
    // 8-bit only: 16-bit doubles the sample stride and 1/2/4-bit pack several pixels per byte, and
    // neither has ever come out of this extension's capture paths.
    if (bitDepth !== 8 || channels === undefined || interlace !== 0) { return undefined; }
    if (width <= 0 || height <= 0) { return undefined; }
    return { width, height, channels };
}

/** Concatenate every IDAT chunk's payload, in file order. */
function readIdat(bytes: Buffer): Buffer | undefined {
    const parts: Buffer[] = [];
    let at = 8;
    while (at + 8 <= bytes.length) {
        const length = bytes.readUInt32BE(at);
        const type = bytes.toString('latin1', at + 4, at + 8);
        const start = at + 8;
        if (start + length > bytes.length) { return undefined; }
        if (type === 'IDAT') { parts.push(bytes.subarray(start, start + length)); }
        if (type === 'IEND') { break; }
        // 4 bytes of length + 4 of type + payload + 4 of CRC.
        at = start + length + 4;
    }
    return parts.length > 0 ? Buffer.concat(parts) : undefined;
}

/** Paeth predictor (PNG filter type 4). */
function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) { return a; }
    return pb <= pc ? b : c;
}

/**
 * Reverse one scanline's filter, in place, given the already-unfiltered line above it. PNG filters
 * are defined per BYTE against the byte `bpp` positions back, not per pixel, which is why this works
 * on raw bytes without knowing the channel layout.
 */
function unfilter(line: Buffer, prev: Buffer, filter: number, bpp: number): void {
    // Callers validate `filter` (see FILTER_MAX) — an unknown filter byte means a corrupt file, and
    // silently treating it as None would decode garbage that still looks like an image.
    for (let i = 0; i < line.length; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const add = filter === 1 ? a
            : filter === 2 ? b
                : filter === 3 ? ((a + b) >> 1)
                    : filter === 4 ? paeth(a, b, c) : 0;
        line[i] = (line[i] + add) & 0xff;
    }
}

/** Where a sampled row/column lands in the source image. */
function sampleAt(index: number, count: number, extent: number): number {
    // Sample the CENTRE of each cell, not its edge: an edge sample of the first row on a phone
    // capture reads the status bar's own border rather than the content under it.
    return Math.min(extent - 1, Math.floor(((index + 0.5) / count) * extent));
}

/**
 * Decode a PNG down to a `cols × rows` grid of 0-255 luminance samples, skipping the top
 * `skipTopFraction` of the image.
 *
 * The skip exists for the clock: a phone's status bar changes every minute, so two otherwise
 * identical captures of one screen differ there and nowhere else. Comparing with the strip included
 * makes every capture look different; excluding it is what lets "identical except the clock" be
 * recognized as identical.
 *
 * Returns undefined for anything unreadable — a truncated file, an unsupported format, a corrupt
 * zlib stream. Callers must treat that as "do not compare", never as "no difference".
 */
export function pngGrayGrid(
    bytes: Buffer, cols: number, rows: number, skipTopFraction = 0,
): Uint8Array | undefined {
    const header = readHeader(bytes);
    if (!header) { return undefined; }
    const idat = readIdat(bytes);
    if (!idat) { return undefined; }
    let raw: Buffer;
    try {
        raw = zlib.inflateSync(idat);
    } catch {
        return undefined;
    }
    const { width, height, channels } = header;
    const stride = width * channels;
    // Each scanline is one filter byte followed by `stride` data bytes.
    if (raw.length < (stride + 1) * height) { return undefined; }
    const top = Math.min(height - 1, Math.floor(height * skipTopFraction));
    const usable = height - top;
    // Refuse rather than guess when the image is too small to fill the grid: two source rows would
    // map to one target row, leaving the rest of the grid at its zero fill — a signature that is
    // part real image and part black, which compares as a confident difference it never measured.
    if (usable < rows || width < cols) { return undefined; }

    const out = new Uint8Array(cols * rows);
    // Rows to sample, mapped into the source once so the decode walk can test membership cheaply.
    const wanted = new Map<number, number>();
    for (let r = 0; r < rows; r++) { wanted.set(top + sampleAt(r, rows, usable), r); }

    let prev = Buffer.alloc(stride);
    const line = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const at = y * (stride + 1);
        const filter = raw[at];
        if (filter > FILTER_MAX) { return undefined; }
        raw.copy(line, 0, at + 1, at + 1 + stride);
        unfilter(line, prev, filter, channels);
        const target = wanted.get(y);
        if (target !== undefined) {
            for (let c = 0; c < cols; c++) {
                const x = sampleAt(c, cols, width) * channels;
                // Rec. 601 luma for RGB; the single channel itself for grayscale. Alpha is ignored —
                // a capture is opaque, and a transparent pixel compared as black would invent change.
                out[target * cols + c] = channels >= 3
                    ? Math.round(0.299 * line[x] + 0.587 * line[x + 1] + 0.114 * line[x + 2])
                    : line[x];
            }
        }
        // Every scanline must be unfiltered even when it is not sampled: filters reference the line
        // above, so skipping one corrupts every line after it.
        prev = Buffer.from(line);
    }
    return out;
}
