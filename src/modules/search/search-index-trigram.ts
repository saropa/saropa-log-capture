/**
 * Trigram extraction + encoding for the cross-session search index (plan 029).
 *
 * A trigram is three consecutive bytes of the lowercased UTF-8 form of the text, packed into a
 * 24-bit integer key. A file's index entry is the SORTED SET of its distinct trigram keys. For a
 * literal query, every trigram of the query must appear in any file that contains the query as a
 * contiguous substring — so a file whose set lacks even one query trigram provably cannot match and
 * is skipped without being read. This is a pure pruning filter: false positives (a file that has all
 * the trigrams but not the substring) are caught by the real scan, so correctness never depends on it.
 */

/** Minimum query length that yields at least one trigram; shorter queries cannot be pruned. */
export const MIN_TRIGRAM_QUERY_LENGTH = 3;

/**
 * Sorted, de-duplicated 24-bit trigram keys of `text` (lowercased, UTF-8 byte trigrams).
 * Returns an empty array when the text is shorter than one trigram.
 */
export function extractTrigrams(text: string): Uint32Array {
    const bytes = Buffer.from(text.toLowerCase(), 'utf-8');
    if (bytes.length < MIN_TRIGRAM_QUERY_LENGTH) {
        return new Uint32Array(0);
    }
    const set = new Set<number>();
    for (let i = 0; i + 2 < bytes.length; i++) {
        set.add((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]);
    }
    // Typed-array sort is numeric (unlike Array.prototype.sort), so the result is correctly ordered
    // for the binary-search superset test in containsAllTrigrams.
    return Uint32Array.from(set).sort();
}

/** Pack a trigram set into a compact little-endian base64 string for on-disk storage. */
export function encodeTrigrams(trigrams: Uint32Array): string {
    const buf = Buffer.alloc(trigrams.length * 4);
    for (let i = 0; i < trigrams.length; i++) {
        buf.writeUInt32LE(trigrams[i], i * 4);
    }
    return buf.toString('base64');
}

/**
 * Decode a base64 trigram blob back into a Uint32Array. Copies through readUInt32LE rather than
 * aliasing the Buffer's ArrayBuffer — a pooled Buffer can start at a non-4-byte offset, which would
 * make `new Uint32Array(buf.buffer, buf.byteOffset, …)` throw a RangeError on misalignment.
 */
export function decodeTrigrams(encoded: string): Uint32Array {
    const buf = Buffer.from(encoded, 'base64');
    const count = Math.floor(buf.length / 4);
    const out = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = buf.readUInt32LE(i * 4);
    }
    return out;
}

/** True when the sorted `fileTrigrams` contains every key in `required` (binary search per key). */
export function containsAllTrigrams(fileTrigrams: Uint32Array, required: Uint32Array): boolean {
    for (let i = 0; i < required.length; i++) {
        if (!sortedHas(fileTrigrams, required[i])) {
            return false;
        }
    }
    return true;
}

/** Binary search for `key` in a sorted Uint32Array. */
function sortedHas(sorted: Uint32Array, key: number): boolean {
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const v = sorted[mid];
        if (v === key) { return true; }
        if (v < key) { lo = mid + 1; } else { hi = mid - 1; }
    }
    return false;
}
