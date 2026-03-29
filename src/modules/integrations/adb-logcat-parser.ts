/**
 * Parses Android logcat lines in threadtime format.
 *
 * Standard threadtime: `MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message`
 * This is the default format for `adb logcat -v threadtime`.
 */

/** A parsed logcat line with extracted metadata. */
export interface LogcatLine {
    /** Timestamp string as emitted by logcat (MM-DD HH:MM:SS.mmm). */
    readonly timestamp: string;
    /** Process ID. */
    readonly pid: number;
    /** Thread ID. */
    readonly tid: number;
    /** Single-char level: V, D, I, W, E, F, or A. */
    readonly level: string;
    /** Logcat tag (e.g. "flutter", "ActivityManager"). */
    readonly tag: string;
    /** Message body after the tag. */
    readonly message: string;
    /** Original unparsed line. */
    readonly raw: string;
}

/**
 * Threadtime regex: captures timestamp, PID, TID, level, tag, and message.
 *
 * Example: `03-29 09:00:20.509 20824 20824 D FirebaseSessions: App backgrounded`
 */
const threadtimeRe =
    /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFA])\s+(.+?):\s(.*)/;

/** Ordered logcat levels from verbose to silent (for minLevel filtering). */
const levelOrder = 'VDIWEFA';

/** Parse a single threadtime-format logcat line. Returns null for unparseable lines. */
export function parseLogcatLine(line: string): LogcatLine | null {
    const m = threadtimeRe.exec(line);
    if (!m) { return null; }
    return {
        timestamp: m[1],
        pid: parseInt(m[2], 10),
        tid: parseInt(m[3], 10),
        level: m[4],
        tag: m[5].trim(),
        message: m[6],
        raw: line,
    };
}

/**
 * Check whether a logcat level passes the minimum level filter.
 * Returns true if `level` is at or above `minLevel` in severity.
 */
export function meetsMinLevel(level: string, minLevel: string): boolean {
    const li = levelOrder.indexOf(level);
    const mi = levelOrder.indexOf(minLevel);
    if (li < 0 || mi < 0) { return true; }
    return li >= mi;
}
