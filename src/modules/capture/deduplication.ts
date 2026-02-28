export interface DeduplicationOptions {
    /** Time window in ms. Identical lines within this window are grouped. */
    readonly windowMs: number;
}

const DEFAULT_OPTIONS: DeduplicationOptions = {
    windowMs: 500,
};

/**
 * Groups identical consecutive log lines arriving within a time window.
 * Instead of writing every duplicate, emits a single line with a count
 * suffix: `Error: Connection Refused (x54)`.
 *
 * Usage: call `process()` for each incoming line. It returns 0, 1, or 2
 * strings to write to the file. Call `flush()` at session end.
 */
export class Deduplicator {
    private readonly windowMs: number;
    private lastLine: string | null = null;
    private lastCount = 0;
    private lastTimestamp = 0;

    constructor(options?: Partial<DeduplicationOptions>) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        this.windowMs = opts.windowMs;
    }

    /**
     * Process an incoming line.
     * @returns 0, 1, or 2 formatted lines to write to the log file.
     *   - 0: line is a duplicate within the window, still accumulating.
     *   - 1: a new unique line, or a finalized group.
     *   - 2: a finalized group line (count > 1) followed by a new unique line.
     */
    process(line: string): string[] {
        const now = Date.now();

        if (
            this.lastLine !== null &&
            line === this.lastLine &&
            (now - this.lastTimestamp) < this.windowMs
        ) {
            this.lastCount++;
            this.lastTimestamp = now;
            return [];
        }

        const results: string[] = [];

        if (this.lastLine !== null && this.lastCount > 1) {
            results.push(formatGrouped(this.lastLine, this.lastCount));
        }

        this.lastLine = line;
        this.lastCount = 1;
        this.lastTimestamp = now;
        results.push(line);

        return results;
    }

    /**
     * Flush any pending grouped line. Call at session end.
     * @returns 0 or 1 line to write.
     */
    flush(): string[] {
        if (this.lastLine !== null && this.lastCount > 1) {
            const result = formatGrouped(this.lastLine, this.lastCount);
            this.reset();
            return [result];
        }
        this.reset();
        return [];
    }

    reset(): void {
        this.lastLine = null;
        this.lastCount = 0;
        this.lastTimestamp = 0;
    }
}

function formatGrouped(line: string, count: number): string {
    return `${line} (x${count})`;
}
