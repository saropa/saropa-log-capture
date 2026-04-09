/**
 * ASCII art line scoring heuristic (plan 046).
 *
 * **Sync contract:** This is the source-of-truth for unit tests. The embedded JavaScript
 * mirror lives in `viewer-data-add-ascii-art-detect.ts`. Keep scoring logic in sync.
 *
 * @module ascii-art-score
 */

/** Characters excluded from punctuation count (JSON/XML structural). */
const STRUCTURAL_CHARS = new Set([123, 125, 34, 58, 91, 93, 60, 62]); // { } " : [ ] < >

/** Penalty patterns: known log formats that resemble art but aren't. */
const PENALTY_RE = /(?:package:|https?:\/\/|0x[0-9a-f]{4,}|[A-Za-z0-9+/]{20,}={0,2}$|^\s*[{[])/i;

/**
 * Score a single plain-text line body (log prefix stripped) on a 0–100 scale.
 * Higher scores indicate more likely ASCII art.
 */
export function scoreAsciiArtLine(body: string): number {
    if (!body || body.length < 3) { return 0; }
    let score = 0;

    /* 1. Shading-character runs. */
    if (/[@#MW&8%]{5,}/.test(body)) { score += 25; }
    else if (/[.\-+~=:]{10,}/.test(body)) { score += 20; }

    /* 2. Consonant clusters (5+ with no vowels). */
    if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(body)) { score += 25; }

    /* 3. High punctuation ratio (>40% non-alnum non-space). */
    let puncCount = 0;
    for (let i = 0; i < body.length; i++) {
        const cc = body.charCodeAt(i);
        if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || cc === 32) { continue; }
        if (STRUCTURAL_CHARS.has(cc)) { continue; }
        puncCount++;
    }
    if (body.length > 0 && puncCount / body.length > 0.4) { score += 25; }

    /* 4. Repeated identical characters (3+ in a row). */
    if (/(.)\1{2,}/.test(body)) { score += 15; }

    /* 5. Low token count: long line with very few space-separated tokens. Art is dense, not wordy. */
    if (body.length >= 15) {
        const tokens = body.split(/\s+/).filter(t => t.length > 0).length;
        if (tokens <= 2) { score += 15; }
    }

    /* Exclusion: known log formats get a penalty. */
    if (PENALTY_RE.test(body)) { score -= 30; }

    return Math.max(0, Math.min(100, score));
}
