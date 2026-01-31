/**
 * Source tag parsing for Android logcat and bracket-prefixed log lines.
 *
 * Extracts the source tag from lines like:
 * - Logcat: "D/FlutterJNI( 3861): message" -> "flutterjni"
 * - Bracket: "[log] message" -> "log"
 * - No match: "plain text" -> null
 *
 * Tags are lowercased so "D/Flutter" and "I/Flutter" merge into "flutter".
 * The logcat level prefix (V/D/I/W/E/F/A) is captured but ignored for grouping.
 *
 * The same regex is inlined in viewer-source-tags.ts for webview-side use.
 */

/**
 * Regex to parse source tags from plain text.
 * Group 1: logcat level (V/D/I/W/E/F/A) — captured but discarded.
 * Group 2: logcat tag name (e.g. "FlutterJNI", "FirebaseSessions").
 * Group 3: bracket tag name (e.g. "log" from "[log]").
 */
const sourceTagPattern = /^(?:([VDIWEFA])\/([^(:\s]+)\s*(?:\(\s*\d+\))?:\s|\[([^\]]+)\]\s)/;

/**
 * Parse a source tag from the plain text of a log line.
 *
 * @param plainText - Text with HTML/ANSI already stripped
 * @returns Lowercase tag name, or null if no recognized prefix
 */
export function parseSourceTag(plainText: string): string | null {
    const m = sourceTagPattern.exec(plainText);
    if (m) {
        const raw = m[2] ?? m[3];
        return raw ? raw.toLowerCase() : null;
    }
    return null;
}
