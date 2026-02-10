/**
 * File loading utilities for the log viewer.
 *
 * Parses historical log files into PendingLine objects for display
 * in the webview. Handles context header detection, category extraction,
 * marker detection, timestamp parsing, and async batch sending.
 */

import { ansiToHtml, escapeHtml } from '../modules/ansi';
import { linkifyHtml, linkifyUrls } from '../modules/source-linker';

/** A parsed log line ready for the webview. */
export interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: number;
    readonly fw?: boolean;
    readonly sourcePath?: string;
}

/** Context for parsing file lines — bundles parameters to stay within limits. */
export interface FileParseContext {
    readonly classifyFrame: (text: string) => boolean | undefined;
    readonly sessionMidnightMs: number;
}

/**
 * Find where the context header ends in a log file.
 * The header (session metadata) is terminated by a line of 10+ '=' characters.
 * Returns the index of the first content line, or 0 if no header is found.
 * Only scans the first 50 lines to avoid false matches deep in log content.
 */
export function findHeaderEnd(lines: readonly string[]): number {
    const limit = Math.min(lines.length, 50);
    for (let i = 0; i < limit; i++) {
        if (/^={10,}$/.test(lines[i].trim())) {
            const next = i + 1;
            if (next < lines.length && lines[next].trim() === '') {
                return next + 1;
            }
            return next;
        }
    }
    return 0;
}

/**
 * Extract key-value metadata from the context header block in a log file.
 * Scans the first 50 lines for lines between the "=== SAROPA LOG CAPTURE"
 * opener and the closing "===" divider. Returns an empty object if no header.
 */
export function parseHeaderFields(
    lines: readonly string[],
): Record<string, string> {
    const result: Record<string, string> = {};
    let inHeader = false;
    const limit = Math.min(lines.length, 50);
    for (let i = 0; i < limit; i++) {
        const line = lines[i];
        if (line.startsWith('=== SAROPA LOG CAPTURE')) {
            inHeader = true;
            continue;
        }
        if (inHeader && /^={10,}$/.test(line.trim())) {
            break;
        }
        if (!inHeader) { continue; }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) { continue; }
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key) { result[key] = value; }
    }
    return result;
}

/**
 * Compute epoch ms for midnight (local time) of the given ISO date.
 * Returns 0 if the date string is invalid or empty — timestamps will remain 0.
 */
export function computeSessionMidnight(isoDate: string): number {
    if (!isoDate) { return 0; }
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) { return 0; }
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** Parse a time string (HH:MM:SS or HH:MM:SS.mmm) into epoch ms. */
export function parseTimeToMs(timeStr: string, midnightMs: number): number {
    if (midnightMs === 0) { return 0; }
    const parts = timeStr.split(/[:.]/);
    if (parts.length < 3) { return 0; }
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    const ms = parts.length > 3 ? parseInt(parts[3], 10) : 0;
    return midnightMs + (h * 3600000) + (m * 60000) + (s * 1000) + ms;
}

/**
 * Send parsed file lines to the webview in async batches.
 * Yields 10ms between batches so the webview can process each one without freezing.
 * After all batches, sends discovered categories to populate the filter dropdown.
 */
export async function sendFileLines(
    lines: readonly string[],
    ctx: FileParseContext,
    postMessage: (msg: unknown) => void,
    seenCategories: Set<string>,
): Promise<void> {
    const batchSize = 500;
    const cats = new Set<string>();
    for (let i = 0; i < lines.length; i += batchSize) {
        const chunk = lines.slice(i, i + batchSize);
        const batch = chunk.map((line) => parseFileLine(line, ctx));
        for (const ln of batch) {
            if (!ln.isMarker) { cats.add(ln.category); }
        }
        postMessage({
            type: 'addLines',
            lines: batch,
            lineCount: Math.min(i + batchSize, lines.length),
        });
        if (i + batchSize < lines.length) {
            await new Promise<void>((r) => setTimeout(r, 10));
        }
    }
    const newCats = [...cats].filter((c) => !seenCategories.has(c));
    for (const c of newCats) {
        seenCategories.add(c);
    }
    if (newCats.length > 0) {
        postMessage({ type: 'setCategories', categories: newCats });
    }
}

/**
 * Parse a raw log file line into a PendingLine for the webview.
 * Detects markers, session boundaries, and extracts timestamps + category.
 */
function parseFileLine(raw: string, ctx: FileParseContext): PendingLine {
    if (/^---\s*(MARKER:|MAX LINES)/.test(raw)) {
        const label = raw.replace(/^-+\s*/, '').replace(/\s*-+$/, '');
        return buildMarkerLine(label);
    }
    if (/^===\s*(SESSION END|SPLIT)/.test(raw)) {
        return buildMarkerLine(raw);
    }
    const tsMatch = raw.match(/^\[([\d:.]+)\]\s*\[(\w+)\]\s?(.*)/);
    if (tsMatch) {
        const ts = parseTimeToMs(tsMatch[1], ctx.sessionMidnightMs);
        return buildFileLine(tsMatch[3], tsMatch[2], ctx.classifyFrame, ts);
    }
    const catMatch = raw.match(/^\[(\w+)\]\s?(.*)/);
    if (catMatch) {
        return buildFileLine(catMatch[2], catMatch[1], ctx.classifyFrame, 0);
    }
    return buildFileLine(raw, 'console', ctx.classifyFrame, 0);
}

/** Build a PendingLine for a visual separator (marker, session end, etc.). */
function buildMarkerLine(text: string): PendingLine {
    return {
        text: escapeHtml(text),
        isMarker: true,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
    };
}

/** Build a PendingLine for a regular log line. Converts ANSI codes to HTML and linkifies paths. */
function buildFileLine(
    text: string,
    category: string,
    classifyFrame: (text: string) => boolean | undefined,
    timestamp: number,
): PendingLine {
    return {
        text: linkifyUrls(linkifyHtml(ansiToHtml(text))),
        isMarker: false,
        lineCount: 0,
        category,
        timestamp,
        fw: classifyFrame(text),
    };
}
