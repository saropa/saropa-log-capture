/**
 * Derive a distinctive search token from a crash's title so it can be correlated against captured logs
 * (plan 054 Stage 5c-4). Pure string logic — unit tested with `node --test`.
 */

/**
 * The most distinctive token to search captured logs for. Prefers the exception/error class name (the
 * last dotted segment, e.g. `java.lang.NullPointerException` → `NullPointerException`); otherwise the
 * longest word over four characters. Returns undefined when nothing distinctive remains — the caller
 * must then skip correlation rather than search for a vague term that matches everything.
 */
export function crashSignatureToken(title: string): string | undefined {
    if (!title) { return undefined; }
    // Split on whitespace and ':' so "SomeException: message" yields the class name, not the prose.
    const words = title.split(/[\s:]+/).filter(Boolean);
    // Reduce dotted/namespaced names to their final segment (the class/symbol).
    const candidates = words.map(w => w.split('.').pop() ?? w).filter(w => w.length > 4);
    if (candidates.length === 0) { return undefined; }
    const exceptionClass = candidates.find(w => /(Exception|Error)$/.test(w));
    if (exceptionClass) { return exceptionClass; }
    return [...candidates].sort((a, b) => b.length - a.length)[0];
}
