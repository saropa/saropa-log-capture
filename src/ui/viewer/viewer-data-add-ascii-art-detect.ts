/**
 * Embedded JavaScript for generalized ASCII art detection via entropy heuristics.
 *
 * Runs a per-line scoring function inside addToData, gated by `viewerDetectAsciiArt`.
 * When 70%+ of a 12-line sliding window score above the per-line threshold, all window
 * lines are retroactively flagged as separators and fed into the existing art-block
 * tracker. A vertical-uniformity bonus rewards blocks with tight line-length spread.
 *
 * **Performance:** bounded O(1) per line — scans a fixed-size window (max 12 entries).
 * Zero cost when the setting is off.
 */

/** Get the embedded JavaScript for ASCII art detection. */
export function getAsciiArtDetectScript(): string {
    return /* javascript */ `
/* ── ASCII art detector (plan 046) ───────────────────────────── */

var aaWindow = [];
var aaMinBlock = 5;

/** Score a single plain-text payload (log prefix already stripped). 0–100 scale. */
function scoreAsciiArtLine(body) {
    if (!body || body.length < 3) return 0;
    var score = 0;
    var len = body.length;

    /* 1. Shading-character runs: heavy chars or light fill runs. */
    if (/[@#MW&8%]{5,}/.test(body)) score += 25;
    else if (/[.\\-+~=:]{10,}/.test(body)) score += 20;

    /* 2. Consonant clusters: 5+ consonants with no vowels — not normal text. */
    if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(body)) score += 25;

    /* 3. High punctuation ratio (>40% non-alnum non-space). */
    var puncCount = 0;
    for (var pi = 0; pi < len; pi++) {
        var cc = body.charCodeAt(pi);
        /* Skip alphanumeric (0-9, A-Z, a-z) and space. */
        if ((cc >= 48 && cc <= 57) || (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || cc === 32) continue;
        /* Skip JSON/XML structural chars: { } " : [ ] < > */
        if (cc === 123 || cc === 125 || cc === 34 || cc === 58 || cc === 91 || cc === 93 || cc === 60 || cc === 62) continue;
        puncCount++;
    }
    if (len > 0 && puncCount / len > 0.4) score += 25;

    /* 4. Repeated identical characters (3+ in a row of same char). */
    if (/(.)\\1{2,}/.test(body)) score += 15;

    /* 5. Low token count: long line with very few space-separated tokens. */
    if (len >= 15) {
        var toks = body.split(/\\s+/).filter(function(t) { return t.length > 0; }).length;
        if (toks <= 2) score += 15;
    }

    /* Exclusion: lines that look like known log formats get a penalty. */
    /* Package paths, URLs, hex, base64, JSON objects. */
    if (/(?:package:|https?:\\/\\/|0x[0-9a-f]{4,}|[A-Za-z0-9+\\/]{20,}={0,2}$|^\s*[{\\[])/i.test(body)) score -= 30;

    return Math.max(0, Math.min(100, score));
}

/**
 * Feed a line into the ASCII art sliding window. Call after the line is pushed
 * to allLines. Returns true if the line was retroactively flagged (caller may
 * need to update art block tracker).
 *
 * Detection uses majority-in-window (70%) rather than strict consecutive runs,
 * so one weak line inside an art block does not break detection. A window-level
 * vertical-uniformity bonus rewards blocks whose trimmed line lengths cluster
 * tightly, which is characteristic of fixed-width ASCII art generators.
 */
function feedAsciiArtDetector(plainText, lineIndex, timestamp) {
    if (!viewerDetectAsciiArt) return false;

    /* Strip log prefix for scoring (same regex as separator detection). */
    var prefixM = (typeof separatorPrefixRe !== 'undefined') ? separatorPrefixRe.exec(plainText) : null;
    var body = prefixM ? plainText.slice(prefixM[0].length) : plainText;
    var trimmed = body.trim();

    var sc = scoreAsciiArtLine(trimmed);

    /* Track this line in the sliding window with body length for uniformity calc. */
    aaWindow.push({ idx: lineIndex, score: sc, ts: timestamp, bLen: trimmed.length });

    /* Keep window bounded. */
    if (aaWindow.length > 20) aaWindow.shift();

    /* --- Majority-in-window detection ------------------------------------ */
    /* Scan backwards from the tail to find the longest recent run where     */
    /* at least 70% of lines score at or above the per-line threshold.       */
    var lineThreshold = 35;
    var majorityPct = 0.7;
    var lookback = Math.min(aaWindow.length, 12);
    var passing = 0;
    var minLen = Infinity;
    var maxLen = 0;

    for (var wi = aaWindow.length - lookback; wi < aaWindow.length; wi++) {
        var e = aaWindow[wi];
        if (e.score >= lineThreshold) passing++;
        if (e.bLen < minLen) minLen = e.bLen;
        if (e.bLen > maxLen) maxLen = e.bLen;
    }

    /* Need at least aaMinBlock lines in the lookback. */
    if (lookback < aaMinBlock) return false;

    /* At least 70% of the window must pass the per-line threshold. */
    if (passing < Math.ceil(lookback * majorityPct)) return false;

    /* --- Window-level bonuses -------------------------------------------- */
    var avgScore = 0;
    for (var si = aaWindow.length - lookback; si < aaWindow.length; si++) {
        avgScore += aaWindow[si].score;
    }
    avgScore = avgScore / lookback;

    /* Vertical uniformity: tight line-length spread is a strong art signal. */
    if (lookback >= aaMinBlock && minLen > 3 && maxLen - minLen < 15) {
        avgScore += 10;
    }

    /* Final gate: average score (with bonuses) must reach the block threshold. */
    if (avgScore < 40) return false;

    /* --- Retroactively flag all window lines as separator art ------------ */
    var flagged = false;
    for (var fi = aaWindow.length - lookback; fi < aaWindow.length; fi++) {
        var entry = aaWindow[fi];
        var item = allLines[entry.idx];
        if (!item || item.isSeparator) continue;
        item.isSeparator = true;
        /* Demote level to info so art lines don't pollute error signals. */
        if (item.level === 'error' || item.level === 'warning') {
            item.level = 'info';
        }
        flagged = true;
    }

    if (flagged) {
        /* Rebuild art block for the retroactively flagged range. */
        var startIdx = aaWindow[aaWindow.length - lookback].idx;
        var endIdx = aaWindow[aaWindow.length - 1].idx;
        /* If the art block tracker was tracking something else, finalize it first. */
        if (typeof finalizeArtBlock === 'function' && artBlockTracker.count > 0) finalizeArtBlock();
        /* Tag the block positions directly. */
        for (var bi = startIdx; bi <= endIdx; bi++) {
            var bItem = allLines[bi];
            if (!bItem) continue;
            if (bi === startIdx) bItem.artBlockPos = 'start';
            else if (bi === endIdx) bItem.artBlockPos = 'end';
            else bItem.artBlockPos = 'middle';
        }
        /* Reset tracker so it does not double-process these lines. */
        artBlockTracker.startIdx = -1;
        artBlockTracker.count = 0;
        /* Clear window so flagged entries don't pollute the next block's detection. */
        aaWindow = [];
    }

    return flagged;
}

/** Reset detector state (called on clear / new session). */
function resetAsciiArtDetector() {
    aaWindow = [];
}
`;
}
