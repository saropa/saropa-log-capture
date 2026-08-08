/**
 * Near-duplicate detection for consecutive captures (field report: "many of your screenshots are
 * identical except for the phone's clock").
 *
 * The capturer already dedups FAULT captures by an error fingerprint, but that is a property of the
 * log line, not of the picture: two navigation captures of the same screen seconds apart carry
 * different trigger text and are both kept, even when the only pixels that changed are the status
 * bar's clock. This module compares the pictures themselves.
 *
 * Pure — no `vscode`, no filesystem — so the rule is testable without the Extension Host. The
 * caller supplies bytes and decides what to do with the verdict.
 *
 * The comparison is a downsampled grayscale signature, not a pixel-by-pixel diff:
 * - a 16 × 32 grid is ~500 samples, so comparing costs microseconds regardless of capture size;
 * - downsampling is what makes it robust to encoder noise and one-pixel shifts, which a strict
 *   comparison would report as change;
 * - the top of the image is excluded (see `CLOCK_STRIP`), because that is where the clock lives.
 */

import { pngGrayGrid } from './png-decode';

/** Signature grid width. Portrait-biased with `SIG_ROWS` — phone captures are far taller than wide. */
export const SIG_COLS = 16;
/** Signature grid height. */
export const SIG_ROWS = 32;

/**
 * Fraction of the image treated as status bar and excluded from the signature. A phone status bar is
 * roughly 3-5% of a portrait screen; 6% covers it with margin. Excluding a little real content is
 * the right error to make — the strip carries a clock and signal bars, never the app state a reader
 * is comparing.
 */
export const CLOCK_STRIP = 0.06;

/**
 * How similar two captures must be to count as the same picture, as a fraction of full scale.
 * 0.985 keeps a genuine content change (a dialog, a new row, a changed number) well clear of the
 * threshold while absorbing compression noise and antialiasing drift.
 */
export const DEFAULT_SIMILARITY = 0.985;

/** A capture's comparison signature. Opaque to callers — only `compareSignatures` reads it. */
export type ShotSignature = Uint8Array;

/**
 * Build a capture's signature, or undefined when the bytes cannot be read. Undefined must be treated
 * as "cannot compare", never as "different" or "same": an unreadable capture is kept.
 */
export function signatureOf(png: Buffer): ShotSignature | undefined {
    return pngGrayGrid(png, SIG_COLS, SIG_ROWS, CLOCK_STRIP);
}

/**
 * Similarity of two signatures, 0 (nothing alike) to 1 (identical). Mean absolute difference over
 * full scale — chosen over a count of differing samples because it degrades smoothly: a screen that
 * dimmed slightly scores just under 1 rather than falling off a cliff the moment every sample moved
 * by one.
 *
 * Mismatched lengths score 0: two captures of different shapes are not comparable, and calling them
 * different is the answer that keeps a capture.
 */
export function compareSignatures(a: ShotSignature, b: ShotSignature): number {
    if (a.length === 0 || a.length !== b.length) { return 0; }
    let total = 0;
    for (let i = 0; i < a.length; i++) { total += Math.abs(a[i] - b[i]); }
    return 1 - (total / (a.length * 255));
}

/**
 * Bounded ring of recent capture signatures.
 *
 * ONE ring for the whole session, deliberately — NOT one per screen. Keying by screen sounds more
 * precise ("have I captured THIS screen looking like this"), and it was tried: measured against a
 * real seven-capture session it skipped nothing at all, where the single ring correctly skipped two
 * exact duplicates. The reason is that the screen label available at capture time comes from the
 * navigation breadcrumb on the triggering line, and that label routinely disagrees with what is
 * actually on screen — a capture taken just after a route change still shows the previous screen.
 * Keying on an unreliable label partitioned identical pictures into separate buckets and lost the
 * whole benefit. The picture is the more reliable identity, so the picture is what is compared.
 *
 * Bounded because the capturer runs for the life of the extension host; a ring rather than "just the
 * last one" because captures often alternate between two screens (A, B, A) and a one-deep memory
 * would call every one of those novel.
 */
export class RecentShotSignatures {
    private entries: ShotSignature[] = [];
    private lastBest: number | undefined;

    constructor(private readonly capacity = 4) { }

    /**
     * The score from the most recent `bestMatch`, so a caller can report how CLOSE a kept capture
     * came without recomputing it. Undefined until a comparison has actually been made.
     */
    get lastBestMatch(): number | undefined { return this.lastBest; }

    /**
     * The best similarity against anything remembered, and nothing when there is no comparison to
     * make. `undefined` (no history) is deliberately distinct from `0` (nothing alike) so a caller
     * cannot mistake an empty history for a confident "this is new".
     */
    bestMatch(signature: ShotSignature): number | undefined {
        if (this.entries.length === 0) { return undefined; }
        let best = 0;
        for (const entry of this.entries) {
            const score = compareSignatures(signature, entry);
            if (score > best) { best = score; }
        }
        this.lastBest = best;
        return best;
    }

    /** Remember a signature, evicting the oldest past capacity. */
    remember(signature: ShotSignature): void {
        this.entries.push(signature);
        if (this.entries.length > this.capacity) { this.entries.shift(); }
    }

    /** Forget everything — called when the log changes, so one session never bleeds into the next. */
    clear(): void {
        this.entries = [];
        this.lastBest = undefined;
    }
}

/**
 * What the capturer should do with a capture it just took. `unreadable` is distinct from `kept`
 * because it means the comparison never happened — the caller reports it once rather than letting
 * dedup look like it silently stopped working.
 */
export type DuplicateVerdict =
    | { readonly duplicate: false; readonly unreadable: boolean }
    | { readonly duplicate: true; readonly similarity: number };

/** Inputs for one duplicate decision, bundled to keep the call inside the parameter limit. */
export interface DuplicateQuery {
    readonly png: Buffer;
    readonly recent: RecentShotSignatures;
    readonly threshold: number;
}

/**
 * Whether this capture is a near-duplicate of a recent one. Only ever answers `true` on a real
 * comparison: unreadable bytes and an empty history both keep the capture. Dropping a capture the
 * user needed is a worse failure than keeping one they did not.
 */
export function duplicateVerdict(query: DuplicateQuery): DuplicateVerdict {
    const { png, recent, threshold } = query;
    const signature = signatureOf(png);
    if (!signature) { return { duplicate: false, unreadable: true }; }
    const best = recent.bestMatch(signature);
    if (best !== undefined && best >= threshold) { return { duplicate: true, similarity: best }; }
    // Only NEW pictures enter the history. Remembering duplicates too would let a long run of
    // near-identical captures drift the ring away from the picture it is meant to represent.
    recent.remember(signature);
    return { duplicate: false, unreadable: false };
}
