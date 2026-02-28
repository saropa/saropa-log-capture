/**
 * Extracts duration/timing values from log line text.
 * Detects common patterns like "took 1.2s", "elapsed: 500ms",
 * "duration=3000", "(1234ms)", "in 2.5 seconds".
 * Returns the duration in milliseconds, or undefined if none found.
 */

const patterns: { regex: RegExp; toMs: (match: RegExpMatchArray) => number }[] = [
    // "500ms", "1234ms", "12 ms"
    { regex: /(\d+(?:\.\d+)?)\s*ms\b/i, toMs: (m) => parseFloat(m[1]) },
    // "1.2s", "3s", "0.5 seconds", "2.5 sec"
    { regex: /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i, toMs: (m) => parseFloat(m[1]) * 1000 },
    // "took 1.2s", "elapsed: 500ms" (captures the value before unit)
    { regex: /(?:took|elapsed|duration)[:\s=]+(\d+(?:\.\d+)?)\s*(?:ms|s)\b/i, toMs: (m) => {
        const val = parseFloat(m[1]);
        return m[0].toLowerCase().includes('ms') ? val : val * 1000;
    }},
    // "duration=3000" (bare number, assumed ms)
    { regex: /duration\s*[=:]\s*(\d+)\b/i, toMs: (m) => parseInt(m[1], 10) },
];

/** Extract a duration in milliseconds from a log line, or undefined if none found. */
export function extractDuration(text: string): number | undefined {
    for (const { regex, toMs } of patterns) {
        const match = text.match(regex);
        if (match) {
            const ms = toMs(match);
            if (ms >= 0 && isFinite(ms)) {
                return ms;
            }
        }
    }
    return undefined;
}
