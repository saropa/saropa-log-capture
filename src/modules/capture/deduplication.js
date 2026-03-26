"use strict";
/**
 * Consecutive duplicate log line grouping. Used by LogSession.appendLine to collapse
 * identical lines within a time window and write a single line with count (e.g. "x54").
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deduplicator = void 0;
const DEFAULT_OPTIONS = {
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
class Deduplicator {
    windowMs;
    lastLine = null;
    lastCount = 0;
    lastTimestamp = 0;
    constructor(options) {
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
    process(line) {
        const now = Date.now();
        if (this.lastLine !== null &&
            line === this.lastLine &&
            (now - this.lastTimestamp) < this.windowMs) {
            this.lastCount++;
            this.lastTimestamp = now;
            return [];
        }
        const results = [];
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
    flush() {
        if (this.lastLine !== null && this.lastCount > 1) {
            const result = formatGrouped(this.lastLine, this.lastCount);
            this.reset();
            return [result];
        }
        this.reset();
        return [];
    }
    reset() {
        this.lastLine = null;
        this.lastCount = 0;
        this.lastTimestamp = 0;
    }
}
exports.Deduplicator = Deduplicator;
function formatGrouped(line, count) {
    return `${line} (x${count})`;
}
//# sourceMappingURL=deduplication.js.map