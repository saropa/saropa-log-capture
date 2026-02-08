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
 * For generic logcat tags (flutter, android, system.err), the parser looks
 * deeper into the message body for sub-tags like [Awesome Notifications]
 * or ALL-CAPS prefixes like HERO-DEBUG.
 *
 * The same logic is mirrored in viewer-source-tags.ts for webview-side use.
 */

/** Logcat/bracket source tag pattern. Groups: 1=level, 2=logcat tag, 3=bracket tag. */
const sourceTagPattern = /^(?:([VDIWEFA])\/([^(:\s]+)\s*(?:\(\s*\d+\))?:\s|\[([^\]]+)\]\s)/;

/** Generic logcat tags where sub-tag detection should look into the message body. */
const genericTags = new Set(['flutter', 'android', 'system.err']);

/** Bracket inline tag anywhere in text: [TagName]. */
const inlineTagPattern = /\[([A-Za-z][A-Za-z0-9 _-]*)\]/;

/** ALL-CAPS prefix at start of message body: HERO-DEBUG, MY_APP, etc. */
const capsPrefix = /^([A-Z][A-Z0-9_-]+) /;

/** Extract a sub-tag from the message body of a generic logcat line. */
function extractSubTag(messageBody: string): string | null {
    const bm = inlineTagPattern.exec(messageBody);
    if (bm?.[1]) { return bm[1].toLowerCase(); }
    const cm = capsPrefix.exec(messageBody);
    if (cm?.[1] && cm[1].length >= 3) { return cm[1].toLowerCase(); }
    return null;
}

/**
 * Parse a source tag from the plain text of a log line.
 *
 * @param plainText - Text with HTML/ANSI already stripped
 * @returns Lowercase tag name, or null if no recognized prefix
 */
export function parseSourceTag(plainText: string): string | null {
    const m = sourceTagPattern.exec(plainText);
    if (!m) { return null; }
    const raw = m[2] ?? m[3];
    if (!raw) { return null; }
    const tag = raw.toLowerCase();
    if (m[2] && genericTags.has(tag)) {
        const body = plainText.slice(m[0].length);
        return extractSubTag(body) ?? tag;
    }
    return tag;
}

/** Return the raw logcat prefix tag (e.g. "flutter" from "I/flutter"). Null for non-logcat lines. */
export function parseLogcatTag(plainText: string): string | null {
    const m = sourceTagPattern.exec(plainText);
    if (!m?.[2]) { return null; }
    return m[2].toLowerCase();
}
