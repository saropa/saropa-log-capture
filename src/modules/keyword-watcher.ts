/**
 * Watches log output for configurable keyword patterns.
 * Tracks hit counts per pattern and returns matches for each line.
 */

/** A single watch pattern with its alert behavior. */
export interface WatchPatternConfig {
    readonly keyword: string;
    readonly alert: 'flash' | 'badge' | 'none';
}

/** A resolved pattern ready for matching. */
interface ResolvedPattern {
    readonly label: string;
    readonly regex: RegExp;
    readonly alert: 'flash' | 'badge' | 'none';
}

/** A match result for a single line. */
export interface WatchHit {
    readonly label: string;
    readonly alert: 'flash' | 'badge' | 'none';
}

/**
 * Matches log lines against a list of keyword patterns.
 * Supports plain string (case-insensitive substring) and
 * regex patterns (prefixed with `/`).
 */
export class KeywordWatcher {
    private readonly patterns: ResolvedPattern[];
    private readonly counts = new Map<string, number>();

    constructor(configs: readonly WatchPatternConfig[]) {
        this.patterns = configs.map(resolvePattern).filter(isNotNull);
        for (const p of this.patterns) {
            this.counts.set(p.label, 0);
        }
    }

    /** Test a line against all patterns. Returns hits (may be empty). */
    testLine(text: string): WatchHit[] {
        const hits: WatchHit[] = [];
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
    getCounts(): ReadonlyMap<string, number> {
        return this.counts;
    }

    /** Reset all hit counts to zero. */
    resetCounts(): void {
        for (const key of this.counts.keys()) {
            this.counts.set(key, 0);
        }
    }
}

/** Parse a config entry into a resolved pattern, or null on invalid regex. */
function resolvePattern(config: WatchPatternConfig): ResolvedPattern | null {
    const { keyword, alert } = config;
    if (keyword.startsWith('/') && keyword.lastIndexOf('/') > 0) {
        const lastSlash = keyword.lastIndexOf('/');
        const pattern = keyword.slice(1, lastSlash);
        const flags = keyword.slice(lastSlash + 1) || 'i';
        try {
            return { label: keyword, regex: new RegExp(pattern, flags), alert };
        } catch {
            return null;
        }
    }
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { label: keyword, regex: new RegExp(escaped, 'i'), alert };
}

function isNotNull<T>(value: T | null): value is T {
    return value !== null;
}
