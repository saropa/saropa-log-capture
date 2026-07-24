/**
 * Suppresses known high-frequency platform spam at capture time.
 *
 * Unlike FloodGuard (byte-identical messages), this catches lines that share a
 * recognizable pattern but vary per frame (PID, buffer id, frame counters).
 * Consecutive matching lines are replaced by one summary in the log file.
 */

/** A known platform spam pattern: all substrings must appear in the line. */
interface SpamPattern {
    readonly name: string;
    readonly substrs: readonly string[];
}

/**
 * BLASTBufferQueue fires per attempted frame during jank on Android 12+.
 * Bursts produce 60-120 lines/sec; a single contacts session logged 213k
 * of these (91% of all cataloged events). The varying parts (PID, surface
 * name, frame counters) prevent FloodGuard from collapsing them.
 */
const knownSpamPatterns: readonly SpamPattern[] = [
    {
        name: 'BLASTBufferQueue',
        substrs: ['BLASTBufferQueue', 'acquireNextBufferLocked'],
    },
];

export interface SpamFlush {
    readonly summary: string;
    readonly timestamp: Date;
}

export interface SpamCheckResult {
    readonly allow: boolean;
    readonly flush?: SpamFlush;
}

/**
 * Accumulates consecutive lines matching a known spam pattern and emits
 * one summary line when the burst ends (a non-matching line arrives or
 * {@link flush} is called at session stop).
 */
export class SpamSuppressor {
    private activePattern: SpamPattern | null = null;
    private count = 0;
    private firstTimestamp: Date | null = null;
    private lastTimestamp: Date | null = null;

    /** Check a line. Returns allow=false to suppress; flush carries the prior burst's summary. */
    check(text: string, now: Date): SpamCheckResult {
        const matched = findMatch(text);

        if (matched && matched === this.activePattern) {
            this.count++;
            this.lastTimestamp = now;
            return { allow: false };
        }

        const flush = this.drain();

        if (matched) {
            this.activePattern = matched;
            this.count = 1;
            this.firstTimestamp = now;
            this.lastTimestamp = now;
            return { allow: false, flush: flush ?? undefined };
        }

        return { allow: true, flush: flush ?? undefined };
    }

    /** Drain any active burst. Call at session stop so the final summary is not lost. */
    flush(): SpamFlush | null {
        return this.drain();
    }

    /** Reset all state (e.g. on session start). */
    reset(): void {
        this.activePattern = null;
        this.count = 0;
        this.firstTimestamp = null;
        this.lastTimestamp = null;
    }

    private drain(): SpamFlush | null {
        if (!this.activePattern || this.count === 0 || !this.firstTimestamp || !this.lastTimestamp) {
            return null;
        }
        const first = formatTime(this.firstTimestamp);
        const last = formatTime(this.lastTimestamp);
        const timeRange = first === last ? first : `${first}–${last}`;
        const summary = `[SPAM SUPPRESSED: ${this.count} ${this.activePattern.name} lines (${timeRange})]`;
        const timestamp = this.lastTimestamp;
        this.activePattern = null;
        this.count = 0;
        this.firstTimestamp = null;
        this.lastTimestamp = null;
        return { summary, timestamp };
    }
}

function findMatch(text: string): SpamPattern | null {
    for (const pattern of knownSpamPatterns) {
        if (pattern.substrs.every(s => text.includes(s))) {
            return pattern;
        }
    }
    return null;
}

function formatTime(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
}
