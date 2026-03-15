/**
 * Keyword extraction for bug report filenames.
 *
 * Scans selected text for severity words, repeated terms, and identifiers
 * to produce a short list of filename-safe keywords.
 */

const severityWords = new Set([
    'error', 'warning', 'fatal', 'exception', 'crash', 'timeout',
    'null', 'overflow', 'denied', 'failed', 'failure', 'panic',
    'oom', 'anr', 'abort', 'segfault', 'deadlock',
]);

const stopWords = new Set([
    'the', 'a', 'an', 'is', 'at', 'in', 'on', 'of', 'to', 'for',
    'and', 'or', 'not', 'but', 'was', 'were', 'been', 'are', 'has',
    'have', 'had', 'this', 'that', 'with', 'from', 'by', 'it', 'its',
    'true', 'false', 'line', 'file', 'log', 'debug', 'info',
]);

/** Extract up to `max` filename-safe keywords from text. */
export function extractKeywords(text: string, max = 3): string[] {
    const found: string[] = [];
    const lower = text.toLowerCase();

    addSeverityHits(lower, found);
    addRepeatedWords(lower, found);
    addIdentifiers(text, found);

    const unique = [...new Set(found)];
    return unique.slice(0, max).map(sanitizeForFilename);
}

function addSeverityHits(lower: string, out: string[]): void {
    for (const word of severityWords) {
        if (lower.includes(word)) { out.push(word); }
    }
}

function addRepeatedWords(lower: string, out: string[]): void {
    const words = lower.match(/[a-z]{3,}/g) ?? [];
    const counts = new Map<string, number>();
    for (const w of words) {
        if (stopWords.has(w) || severityWords.has(w)) { continue; }
        counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const repeated = [...counts.entries()]
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1]);
    for (const [word] of repeated) { out.push(word); }
}

function addIdentifiers(text: string, out: string[]): void {
    const camelCase = text.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)+/g) ?? [];
    for (const id of camelCase) { out.push(id.toLowerCase()); }
    const fileNames = text.match(/[\w-]+\.\w{1,5}/g) ?? [];
    for (const f of fileNames) {
        const base = f.split('.')[0].toLowerCase();
        if (base.length >= 3 && !stopWords.has(base)) { out.push(base); }
    }
}

function sanitizeForFilename(word: string): string {
    return word.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
}
