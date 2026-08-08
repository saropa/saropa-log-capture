import * as assert from 'node:assert';
import * as zlib from 'node:zlib';
import { pngGrayGrid } from '../../../modules/screenshot/png-decode';
import {
    CLOCK_STRIP, DEFAULT_SIMILARITY, RecentShotSignatures, SIG_COLS, SIG_ROWS,
    compareSignatures, duplicateVerdict, signatureOf,
} from '../../../modules/screenshot/screenshot-similarity';

/**
 * The PNGs here are BUILT, not fixtures: the decoder's whole job is reading the real format, so a
 * test that fed it a hand-made byte array would be testing the array. These encode with the same
 * `zlib` the decoder inflates with, which exercises the chunk walk, the filter reversal, and the
 * sampling on genuinely valid files.
 */

/** CRC32, as the PNG spec defines it — needed because a chunk without a valid length walk is unreadable. */
function crcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
        table[n] = c >>> 0;
    }
    return table;
}
const CRC = crcTable();

function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (const byte of buf) { c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8); }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([head, body, crc]);
}

/**
 * Encode an RGBA image. `pixel(x, y)` returns [r,g,b,a]. Filter type 0 (none) on every scanline —
 * the decoder's other filter branches are exercised separately.
 */
function makePng(
    width: number, height: number, pixel: (x: number, y: number) => number[], filter = 0,
): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // color type: RGBA
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        const at = y * (stride + 1);
        raw[at] = filter;
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixel(x, y);
            const p = at + 1 + x * 4;
            // Filter 1 (Sub) stores the difference from the pixel to the left, so the encoder has to
            // apply it too — otherwise the test would assert the decoder against unfiltered bytes.
            const prev = x > 0 ? pixel(x - 1, y) : [0, 0, 0, 0];
            raw[p] = filter === 1 ? (r - prev[0]) & 0xff : r;
            raw[p + 1] = filter === 1 ? (g - prev[1]) & 0xff : g;
            raw[p + 2] = filter === 1 ? (b - prev[2]) & 0xff : b;
            raw[p + 3] = filter === 1 ? (a - prev[3]) & 0xff : a;
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

/**
 * Encode with a chosen filter type by ENCODING the filter properly (not just stamping the byte), so
 * a decoder that ignored the filter would produce different pixels and fail the comparison.
 * Grayscale-friendly: works on the single luma value, then expands to RGBA.
 */
function makeFiltered(width: number, height: number, value: (x: number, y: number) => number, filter: number): Buffer {
    const at = (x: number, y: number) => (x < 0 || y < 0 ? 0 : value(x, y));
    return makePngRaw({ width, height, channels: 4, filter }, (x, y, ch) => {
        const raw = ch === 3 ? 255 : value(x, y);
        const a = x > 0 ? (ch === 3 ? 255 : at(x - 1, y)) : 0;
        const b = y > 0 ? (ch === 3 ? 255 : at(x, y - 1)) : 0;
        const c = x > 0 && y > 0 ? (ch === 3 ? 255 : at(x - 1, y - 1)) : 0;
        const pred = filter === 1 ? a
            : filter === 2 ? b
                : filter === 3 ? ((a + b) >> 1)
                    : filter === 4 ? paethRef(a, b, c) : 0;
        return (raw - pred) & 0xff;
    });
}

/** Reference Paeth, written independently of the decoder's copy so the test is not self-confirming. */
function paethRef(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) { return a; }
    return pb <= pc ? b : c;
}

/** Shape of a hand-encoded PNG, bundled to keep `makePngRaw` inside the parameter limit. */
interface RawPngSpec {
    readonly width: number;
    readonly height: number;
    readonly channels: number;
    readonly filter: number;
}

/** Encode arbitrary channel counts / filter bytes. `byteOf(x, y, channel)` supplies FILTERED bytes. */
function makePngRaw(spec: RawPngSpec, byteOf: (x: number, y: number, channel: number) => number): Buffer {
    const { width, height, channels, filter } = spec;
    const colorType = channels === 1 ? 0 : channels === 2 ? 4 : channels === 3 ? 2 : 6;
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = colorType;
    const stride = width * channels;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        const at = y * (stride + 1);
        raw[at] = filter;
        for (let x = 0; x < width; x++) {
            for (let ch = 0; ch < channels; ch++) { raw[at + 1 + x * channels + ch] = byteOf(x, y, ch); }
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

/** A flat mid-gray image with an optional differently-colored band of rows. */
function banded(height: number, bandFrom: number, bandTo: number, bandValue: number): Buffer {
    return makePng(20, height, (_x, y) => {
        const v = y >= bandFrom && y < bandTo ? bandValue : 128;
        return [v, v, v, 255];
    });
}

suite('Screenshot near-duplicate detection', () => {

    suite('pngGrayGrid', () => {
        test('should decode a valid RGBA PNG to the requested grid size', () => {
            const grid = pngGrayGrid(makePng(8, 8, () => [10, 20, 30, 255]), 4, 4);
            assert.ok(grid, 'decoded');
            assert.strictEqual(grid.length, 16);
            // Rec.601 luma of (10,20,30) ≈ 17.
            assert.ok(Math.abs(grid[0] - 17) <= 1, `luma ${grid[0]}`);
        });

        test('should reverse the Sub filter, not just read raw bytes', () => {
            // Every scanline filtered; a decoder that ignored the filter byte would return the
            // deltas instead of the pixels and this comparison would fail.
            const flat = pngGrayGrid(makePng(8, 8, () => [90, 90, 90, 255], 0), 4, 4);
            const subbed = pngGrayGrid(makePng(8, 8, () => [90, 90, 90, 255], 1), 4, 4);
            assert.ok(flat && subbed);
            assert.deepStrictEqual([...subbed], [...flat], 'both filters decode to the same image');
        });

        test('should reverse EVERY filter type to the same image', () => {
            // Up, Average and Paeth are the branches most easily written subtly wrong, and a gradient
            // exercises them — a flat image decodes correctly even under a broken predictor.
            const gradient = (x: number, y: number) => (x * 13 + y * 29) & 0xff;
            const expected = pngGrayGrid(makeFiltered(16, 16, gradient, 0), 8, 8);
            assert.ok(expected, 'unfiltered baseline decodes');
            for (const filter of [1, 2, 3, 4]) {
                const got = pngGrayGrid(makeFiltered(16, 16, gradient, filter), 8, 8);
                assert.ok(got, `filter ${filter} decodes`);
                assert.deepStrictEqual([...got], [...expected], `filter ${filter} reverses to the same image`);
            }
        });

        test('should read a grayscale image without the RGB luma path', () => {
            const gray = makePngRaw({ width: 16, height: 16, channels: 1, filter: 0 }, (x, y) => (x * 7 + y * 3) & 0xff);
            const grid = pngGrayGrid(gray, 8, 8);
            assert.ok(grid, 'grayscale decodes');
            // The single channel IS the luma, so a mid sample must be its own value, not a weighted mix.
            assert.strictEqual(grid[0], (1 * 7 + 1 * 3) & 0xff);
        });

        test('should reject a palette image and an interlaced one rather than misreading them', () => {
            const palette = makePng(8, 8, () => [1, 2, 3, 255]);
            palette[25] = 3; // color type 3 = palette, which this reader does not handle
            assert.strictEqual(pngGrayGrid(palette, 4, 4), undefined, 'palette rejected');
            const interlaced = makePng(8, 8, () => [1, 2, 3, 255]);
            interlaced[28] = 1; // Adam7
            assert.strictEqual(pngGrayGrid(interlaced, 4, 4), undefined, 'interlaced rejected');
        });

        test('should reject an invalid filter byte instead of decoding it as unfiltered', () => {
            const png = makePngRaw({ width: 8, height: 8, channels: 4, filter: 9 }, () => 100);
            assert.strictEqual(pngGrayGrid(png, 4, 4), undefined);
        });

        test('should refuse an image too small to fill the requested grid', () => {
            // A partly-sampled grid would leave the rest black and compare as confident difference.
            assert.strictEqual(pngGrayGrid(makePng(4, 4, () => [9, 9, 9, 255]), 8, 8), undefined);
            assert.ok(pngGrayGrid(makePng(8, 8, () => [9, 9, 9, 255]), 8, 8), 'exactly big enough is fine');
        });

        test('should reject a non-PNG, a truncated file, and a corrupt stream', () => {
            assert.strictEqual(pngGrayGrid(Buffer.from('not a png at all'), 4, 4), undefined);
            const good = makePng(4, 4, () => [1, 2, 3, 255]);
            assert.strictEqual(pngGrayGrid(good.subarray(0, 20), 4, 4), undefined, 'truncated');
            const corrupt = Buffer.from(good);
            corrupt.fill(0, 50, 60);
            assert.strictEqual(pngGrayGrid(corrupt, 4, 4), undefined, 'corrupt zlib stream');
        });

        test('should refuse an unsupported bit depth rather than guessing', () => {
            const png = makePng(4, 4, () => [1, 2, 3, 255]);
            png[24] = 16; // bit depth in IHDR
            assert.strictEqual(pngGrayGrid(png, 4, 4), undefined);
        });

        test('should EXCLUDE the top strip — that is where the clock lives', () => {
            // Two images identical except in their top 10% of rows.
            const a = banded(100, 0, 10, 0);
            const b = banded(100, 0, 10, 255);
            const ga = pngGrayGrid(a, 4, 8, 0.10);
            const gb = pngGrayGrid(b, 4, 8, 0.10);
            assert.ok(ga && gb);
            assert.deepStrictEqual([...ga], [...gb], 'the differing strip is not sampled');
            // Without the skip the same pair must differ, or the test above proves nothing.
            const na = pngGrayGrid(a, 4, 8, 0);
            const nb = pngGrayGrid(b, 4, 8, 0);
            assert.ok(na && nb);
            assert.notDeepStrictEqual([...na], [...nb], 'and IS sampled when the strip is included');
        });
    });

    suite('compareSignatures', () => {
        test('should score an identical pair 1', () => {
            const sig = signatureOf(makePng(20, 40, () => [60, 60, 60, 255]));
            assert.ok(sig);
            assert.strictEqual(compareSignatures(sig, sig), 1);
        });

        test('should score black against white 0', () => {
            const black = signatureOf(makePng(20, 40, () => [0, 0, 0, 255]));
            const white = signatureOf(makePng(20, 40, () => [255, 255, 255, 255]));
            assert.ok(black && white);
            assert.strictEqual(compareSignatures(black, white), 0);
        });

        test('should score mismatched lengths 0 rather than throwing or matching', () => {
            assert.strictEqual(compareSignatures(new Uint8Array([1, 2]), new Uint8Array([1])), 0);
            assert.strictEqual(compareSignatures(new Uint8Array(), new Uint8Array()), 0);
        });

        test('should degrade smoothly instead of falling off a cliff', () => {
            const base = signatureOf(makePng(20, 40, () => [100, 100, 100, 255]));
            const nudged = signatureOf(makePng(20, 40, () => [103, 103, 103, 255]));
            assert.ok(base && nudged);
            const score = compareSignatures(base, nudged);
            assert.ok(score > 0.98 && score < 1, `a small shift scores ${score}, near but not equal to 1`);
        });
    });

    suite('duplicateVerdict', () => {
        const png = (v: number) => makePng(20, 40, () => [v, v, v, 255]);

        test('should never call the FIRST capture a duplicate', () => {
            const recent = new RecentShotSignatures();
            assert.strictEqual(duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY }).duplicate, false);
        });

        test('should call a repeat of the same picture a duplicate', () => {
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            const verdict = duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(verdict.duplicate, true);
            assert.ok(verdict.duplicate && verdict.similarity >= DEFAULT_SIMILARITY);
        });

        test('should keep a genuinely different picture', () => {
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: png(20), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(duplicateVerdict({ png: png(220), recent, threshold: DEFAULT_SIMILARITY }).duplicate, false);
        });

        test('should KEEP a capture it cannot read — uncertainty must never discard', () => {
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(duplicateVerdict({ png: Buffer.from('junk'), recent, threshold: DEFAULT_SIMILARITY }).duplicate, false);
        });

        test('should catch an A-B-A alternation, which a last-one-only memory would miss', () => {
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: png(30), recent, threshold: DEFAULT_SIMILARITY });
            duplicateVerdict({ png: png(200), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(duplicateVerdict({ png: png(30), recent, threshold: DEFAULT_SIMILARITY }).duplicate, true,
                'the screen from two captures ago is still remembered');
        });

        test('should bound what it remembers', () => {
            const recent = new RecentShotSignatures(2);
            duplicateVerdict({ png: png(30), recent, threshold: DEFAULT_SIMILARITY });
            duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            duplicateVerdict({ png: png(220), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(duplicateVerdict({ png: png(30), recent, threshold: DEFAULT_SIMILARITY }).duplicate, false,
                'the oldest signature was evicted, so its screen reads as new again');
        });

        test('should forget everything on clear, so one session never bleeds into the next', () => {
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            recent.clear();
            assert.strictEqual(duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY }).duplicate, false);
        });

        test('should report an unreadable capture distinctly from a kept one', () => {
            // The caller says so once — otherwise an unsupported PNG form looks like a setting that
            // quietly stopped working.
            const recent = new RecentShotSignatures();
            const bad = duplicateVerdict({ png: Buffer.from('junk'), recent, threshold: DEFAULT_SIMILARITY });
            assert.deepStrictEqual(bad, { duplicate: false, unreadable: true });
            const good = duplicateVerdict({ png: png(120), recent, threshold: DEFAULT_SIMILARITY });
            assert.deepStrictEqual(good, { duplicate: false, unreadable: false });
        });

        test('should treat two captures differing ONLY in the clock strip as the same picture', () => {
            // The reported symptom, end to end: identical screens whose status bar changed.
            const withClock = (v: number) => makePng(SIG_COLS * 2, SIG_ROWS * 2, (_x, y) =>
                (y < Math.floor(SIG_ROWS * 2 * CLOCK_STRIP) ? [v, v, v, 255] : [140, 140, 140, 255]));
            const recent = new RecentShotSignatures();
            duplicateVerdict({ png: withClock(0), recent, threshold: DEFAULT_SIMILARITY });
            assert.strictEqual(duplicateVerdict({ png: withClock(255), recent, threshold: DEFAULT_SIMILARITY }).duplicate, true);
        });
    });
});
