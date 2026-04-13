/**
 * Structured log line parser — detects known log formats, extracts metadata,
 * and returns the stripped message body.
 *
 * Three tiers of detection:
 * 1. **Known source** — caller passes a format ID; only that format's regex runs.
 * 2. **Sniffed format** — sniffer chose a primary format; try it first, fall back to chain.
 * 3. **Full chain** — try every format in priority order (most expensive).
 *
 * Extension-side only. Webview mirrors the same logic in embedded JS.
 */

import { type LineFormat, type ParsedLinePrefix, LINE_FORMATS } from './structured-line-formats';

/** Index formats by ID for O(1) lookup in known-source tier. */
const formatById = new Map<string, LineFormat>(
    LINE_FORMATS.map((f) => [f.id, f]),
);

/**
 * Try to parse a line using a single format.
 * Returns the parsed prefix or null if the format doesn't match.
 */
function tryFormat(fmt: LineFormat, line: string): ParsedLinePrefix | null {
    const m = fmt.pattern.exec(line);
    if (!m) { return null; }
    return fmt.extract(m, line);
}

/**
 * Parse a structured log line, extracting metadata and stripping the prefix.
 *
 * @param line      Raw line text (plain text, not HTML).
 * @param formatId  Known format ID (tier 1) or sniffed primary format (tier 2).
 *                  Pass `undefined` for full-chain detection (tier 3).
 * @returns Parsed prefix with metadata and stripped message, or null if no format matched.
 */
export function parseStructuredLine(
    line: string,
    formatId?: string,
): ParsedLinePrefix | null {
    if (!line) { return null; }

    // Tier 1/2: try the specified format first.
    if (formatId) {
        const fmt = formatById.get(formatId);
        if (fmt) {
            const result = tryFormat(fmt, line);
            if (result) { return result; }
        }
        // Tier 2 fallback: if sniffed format didn't match, try the full chain.
    }

    // Tier 3: full chain — try every format in priority order.
    for (const fmt of LINE_FORMATS) {
        const result = tryFormat(fmt, line);
        if (result) { return result; }
    }

    return null;
}
