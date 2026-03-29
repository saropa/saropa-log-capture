"use strict";
/**
 * Parses Android logcat lines in threadtime format.
 *
 * Standard threadtime: `MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: message`
 * This is the default format for `adb logcat -v threadtime`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLogcatLine = parseLogcatLine;
exports.meetsMinLevel = meetsMinLevel;
/**
 * Threadtime regex: captures timestamp, PID, TID, level, tag, and message.
 *
 * Example: `03-29 09:00:20.509 20824 20824 D FirebaseSessions: App backgrounded`
 */
const threadtimeRe = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFA])\s+(.+?):\s(.*)/;
/** Ordered logcat levels from verbose to silent (for minLevel filtering). */
const levelOrder = 'VDIWEFA';
/** Parse a single threadtime-format logcat line. Returns null for unparseable lines. */
function parseLogcatLine(line) {
    const m = threadtimeRe.exec(line);
    if (!m) {
        return null;
    }
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
function meetsMinLevel(level, minLevel) {
    const li = levelOrder.indexOf(level);
    const mi = levelOrder.indexOf(minLevel);
    if (li < 0 || mi < 0) {
        return true;
    }
    return li >= mi;
}
//# sourceMappingURL=adb-logcat-parser.js.map