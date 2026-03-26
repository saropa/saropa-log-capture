"use strict";
/**
 * Watches log output for configurable keyword patterns.
 * Tracks hit counts per pattern and returns matches for each line.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordWatcher = void 0;
/**
 * Matches log lines against a list of keyword patterns.
 * Supports plain string (case-insensitive substring) and
 * regex patterns (prefixed with `/`).
 */
class KeywordWatcher {
    patterns;
    counts = new Map();
    constructor(configs) {
        this.patterns = configs.map(resolvePattern).filter(isNotNull);
        for (const p of this.patterns) {
            this.counts.set(p.label, 0);
        }
    }
    /** Test a line against all patterns. Returns hits (may be empty). */
    testLine(text) {
        const hits = [];
        for (const p of this.patterns) {
            p.regex.lastIndex = 0;
            if (p.regex.test(text)) {
                this.counts.set(p.label, (this.counts.get(p.label) ?? 0) + 1);
                hits.push({ label: p.label, alert: p.alert });
            }
        }
        return hits;
    }
    /** Get current hit counts per pattern label. */
    getCounts() {
        return this.counts;
    }
    /** Reset all hit counts to zero. */
    resetCounts() {
        for (const key of this.counts.keys()) {
            this.counts.set(key, 0);
        }
    }
}
exports.KeywordWatcher = KeywordWatcher;
/** Parse a config entry into a resolved pattern, or null on invalid regex. */
function resolvePattern(config) {
    const { keyword, alert } = config;
    if (keyword.startsWith('/') && keyword.lastIndexOf('/') > 0) {
        const lastSlash = keyword.lastIndexOf('/');
        const pattern = keyword.slice(1, lastSlash);
        const flags = keyword.slice(lastSlash + 1) || 'i';
        try {
            return { label: keyword, regex: new RegExp(pattern, flags), alert };
        }
        catch {
            return null;
        }
    }
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { label: keyword, regex: new RegExp(escaped, 'i'), alert };
}
function isNotNull(value) {
    return value !== null;
}
//# sourceMappingURL=keyword-watcher.js.map