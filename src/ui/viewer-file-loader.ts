/**
 * File loading utilities for the log viewer.
 *
 * Parses historical log files into PendingLine objects for display
 * in the webview. Handles context header detection, category extraction,
 * marker detection, and async batch sending to avoid UI freezing.
 */

import { ansiToHtml, escapeHtml } from '../modules/ansi';
import { linkifyHtml } from '../modules/source-linker';

/** A parsed log line ready for the webview. */
export interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: number;
    readonly fw?: boolean;
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
 * Send parsed file lines to the webview in async batches.
 * Yields 10ms between batches so the webview can process each one without freezing.
 * After all batches, sends discovered categories to populate the filter dropdown.
 *
 * @param lines - Content lines from the log file (after header)
 * @param classifyFrame - Function to classify stack frame lines
 * @param postMessage - Function to send messages to the webview
 * @param seenCategories - Set tracking previously seen categories
 */
export async function sendFileLines(
    lines: readonly string[],
    classifyFrame: (text: string) => boolean | undefined,
    postMessage: (msg: unknown) => void,
    seenCategories: Set<string>,
): Promise<void> {
    const batchSize = 500;
    const cats = new Set<string>();
    for (let i = 0; i < lines.length; i += batchSize) {
        const chunk = lines.slice(i, i + batchSize);
        const batch = chunk.map((line) => parseFileLine(line, classifyFrame));
        for (const ln of batch) {
            if (!ln.isMarker) {
                cats.add(ln.category);
            }
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
 * Detects markers (--- MARKER: ...) and session boundaries (=== SESSION END ...).
 * Extracts the [category] prefix from formatted lines.
 */
function parseFileLine(
    raw: string,
    classifyFrame: (text: string) => boolean | undefined,
): PendingLine {
    if (/^---\s*(MARKER:|MAX LINES)/.test(raw)) {
        const label = raw.replace(/^-+\s*/, '').replace(/\s*-+$/, '');
        return buildMarkerLine(label);
    }
    if (/^===\s*(SESSION END|SPLIT)/.test(raw)) {
        return buildMarkerLine(raw);
    }
    const tsMatch = raw.match(/^\[[\d:.]+\]\s*\[(\w+)\]\s?(.*)/);
    if (tsMatch) {
        return buildFileLine(tsMatch[2], tsMatch[1], classifyFrame);
    }
    const catMatch = raw.match(/^\[(\w+)\]\s?(.*)/);
    if (catMatch) {
        return buildFileLine(catMatch[2], catMatch[1], classifyFrame);
    }
    return buildFileLine(raw, 'console', classifyFrame);
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
): PendingLine {
    return {
        text: linkifyHtml(ansiToHtml(text)),
        isMarker: false,
        lineCount: 0,
        category,
        timestamp: 0,
        fw: classifyFrame(text),
    };
}
