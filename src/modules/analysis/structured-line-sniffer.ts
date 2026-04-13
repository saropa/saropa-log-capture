/**
 * Format sniffer — detects the primary structured log format of a file
 * by sampling lines from the beginning and middle.
 *
 * Used for file-loaded / unknown-source logs (tier 2). Known sources
 * (live logcat, Docker, etc.) skip sniffing entirely.
 */

import { LINE_FORMATS } from './structured-line-formats';

/** Number of lines to sample from the file start. */
const HEAD_SAMPLE_SIZE = 50;

/** Number of lines to sample from the file middle. */
const MID_SAMPLE_SIZE = 10;

/** Minimum percentage of sampled lines that must match a format to select it. */
const MIN_MATCH_RATIO = 0.6;

/**
 * Sniff the primary format of a set of log lines.
 *
 * Samples lines from the head and middle of the array, tests each against
 * all known formats, and returns the format ID with the most matches
 * (if it exceeds the minimum match ratio).
 *
 * @param lines  All lines in the file (plain text, one per element).
 * @returns Format ID of the detected primary format, or `undefined` if none matched.
 */
export function sniffFormat(lines: readonly string[]): string | undefined {
    if (lines.length === 0) { return undefined; }

    const sample = collectSample(lines);
    if (sample.length === 0) { return undefined; }

    return pickBestFormat(sample);
}

/** Collect sample lines from head and middle of the file. */
function collectSample(lines: readonly string[]): string[] {
    const result: string[] = [];

    // Head sample: first N non-empty lines.
    const headEnd = Math.min(lines.length, HEAD_SAMPLE_SIZE);
    for (let i = 0; i < headEnd; i++) {
        if (lines[i].trim()) { result.push(lines[i]); }
    }

    // Middle sample: ~10 lines from the 50% offset.
    if (lines.length > HEAD_SAMPLE_SIZE * 2) {
        const midStart = Math.floor(lines.length / 2);
        const midEnd = Math.min(lines.length, midStart + MID_SAMPLE_SIZE);
        for (let i = midStart; i < midEnd; i++) {
            if (lines[i].trim()) { result.push(lines[i]); }
        }
    }

    return result;
}

/** Test all formats against sample lines and return the best-matching format ID. */
function pickBestFormat(sample: readonly string[]): string | undefined {
    let bestId: string | undefined;
    let bestCount = 0;

    for (const fmt of LINE_FORMATS) {
        let count = 0;
        for (const line of sample) {
            if (fmt.pattern.test(line)) { count++; }
        }
        if (count > bestCount) {
            bestCount = count;
            bestId = fmt.id;
        }
    }

    if (!bestId || bestCount / sample.length < MIN_MATCH_RATIO) {
        return undefined;
    }

    return bestId;
}
