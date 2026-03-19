/**
 * File loading utilities for the log viewer.
 *
 * Parses historical log files into PendingLine objects for display
 * in the webview. Handles context header detection, category extraction,
 * marker detection, timestamp parsing, and async batch sending.
 */

import { ansiToHtml, escapeHtml } from '../../modules/capture/ansi';
import { linkifyHtml, linkifyUrls } from '../../modules/source/source-linker';

/** Stream source id for multi-source filtering (debug = DAP, terminal = terminal sidecar, etc.). */
export const SOURCE_DEBUG = 'debug';

/** A parsed log line ready for the webview. */
export interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: number;
    /** Elapsed ms since previous line (e.g. from [+125ms] in file). Used for replay timing. */
    readonly elapsedMs?: number;
    readonly fw?: boolean;
    readonly sourcePath?: string;
    /** Per-file line coverage percent (0–100) for stack frames referencing app code. */
    readonly qualityPercent?: number;
    /** Stream source id for filtering (e.g. 'debug', 'terminal'). Omitted = debug. */
    readonly source?: string;
}

/** Context for parsing file lines — bundles parameters to stay within limits. */
export interface FileParseContext {
    readonly classifyFrame: (text: string) => boolean | undefined;
    readonly sessionMidnightMs: number;
    /** Stream source id for multi-source view (e.g. SOURCE_DEBUG). Omit for default 'debug'. */
    readonly source?: string;
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
    if (Number.isNaN(d.getTime())) { return 0; }
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** Parse a time string (HH:MM:SS or HH:MM:SS.mmm) into epoch ms. */
export function parseTimeToMs(timeStr: string, midnightMs: number): number {
    if (midnightMs === 0) { return 0; }
    const parts = timeStr.split(/[:.]/);
    if (parts.length < 3) { return 0; }
    const h = Number.parseInt(parts[0], 10);
    const m = Number.parseInt(parts[1], 10);
    const s = Number.parseInt(parts[2], 10);
    const ms = parts.length > 3 ? Number.parseInt(parts[3], 10) : 0;
    return midnightMs + (h * 3600000) + (m * 60000) + (s * 1000) + ms;
}

/** Parse elapsed prefix "+125ms", "+1.5s", "+15s" into ms. Returns undefined if not matched. */
export function parseElapsedToMs(elapsedStr: string): number | undefined {
    const m = /^\+(\d+(?:\.\d+)?)(ms|s)$/.exec(elapsedStr);
    if (!m) { return undefined; }
    const val = Number.parseFloat(m[1]);
    if (!Number.isFinite(val) || val < 0) { return undefined; }
    return m[2] === 's' ? Math.round(val * 1000) : Math.round(val);
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
 * Detects markers, session boundaries, and extracts timestamps, optional [+Nms] elapsed, and category.
 */
function parseFileLine(raw: string, ctx: FileParseContext): PendingLine {
    const src = ctx.source ?? SOURCE_DEBUG;
    if (/^---\s*(MARKER:|MAX LINES)/.test(raw)) {
        const label = raw.replace(/^-+\s*/, '').replace(/\s*-+$/, '');
        return buildMarkerLine(label, src);
    }
    if (/^===\s*(SESSION END|SPLIT)/.test(raw)) {
        return buildMarkerLine(raw, src);
    }
    // [time] [+elapsed] [category] rest
    const timeElapsedCat = /^\[([\d:.]+)\]\s*\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (timeElapsedCat) {
        const ts = parseTimeToMs(timeElapsedCat[1], ctx.sessionMidnightMs);
        const elapsed = parseElapsedToMs(timeElapsedCat[2]);
        return buildFileLine({ text: timeElapsedCat[4], category: timeElapsedCat[3], classifyFrame: ctx.classifyFrame, timestamp: ts, elapsedMs: elapsed, source: src });
    }
    // [time] [category] rest
    const tsMatch = /^\[([\d:.]+)\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (tsMatch) {
        const ts = parseTimeToMs(tsMatch[1], ctx.sessionMidnightMs);
        return buildFileLine({ text: tsMatch[3], category: tsMatch[2], classifyFrame: ctx.classifyFrame, timestamp: ts, source: src });
    }
    // [+elapsed] [category] rest (no absolute time)
    const elapsedCat = /^\[(\+\d+(?:\.\d+)?(?:ms|s))\]\s*\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (elapsedCat) {
        const elapsed = parseElapsedToMs(elapsedCat[1]);
        return buildFileLine({ text: elapsedCat[3], category: elapsedCat[2], classifyFrame: ctx.classifyFrame, timestamp: 0, elapsedMs: elapsed, source: src });
    }
    // [category] rest
    const catMatch = /^\[([\w-]+)\]\s?(.*)$/.exec(raw);
    if (catMatch) {
        return buildFileLine({ text: catMatch[2], category: catMatch[1], classifyFrame: ctx.classifyFrame, timestamp: 0, source: src });
    }
    return buildFileLine({ text: raw, category: 'console', classifyFrame: ctx.classifyFrame, timestamp: 0, source: src });
}

/** Build a PendingLine for a visual separator (marker, session end, etc.). */
function buildMarkerLine(text: string, source?: string): PendingLine {
    return {
        text: escapeHtml(text),
        isMarker: true,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
        ...(source ? { source } : {}),
    };
}

interface FileLineOptions {
    text: string;
    category: string;
    classifyFrame: (text: string) => boolean | undefined;
    timestamp: number;
    elapsedMs?: number;
    source?: string;
}

/** Build a PendingLine for a regular log line. Converts ANSI codes to HTML and linkifies paths. */
function buildFileLine(opts: FileLineOptions): PendingLine {
    return {
        text: linkifyUrls(linkifyHtml(ansiToHtml(opts.text))),
        isMarker: false,
        lineCount: 0,
        category: opts.category,
        timestamp: opts.timestamp,
        ...(opts.elapsedMs !== undefined && opts.elapsedMs >= 0 ? { elapsedMs: opts.elapsedMs } : {}),
        fw: opts.classifyFrame(opts.text),
        ...(opts.source ? { source: opts.source } : {}),
    };
}

/**
 * Parse raw log file lines into PendingLine[] for the webview.
 * Used by tail mode to append new lines when a watched file changes.
 */
export function parseRawLinesToPending(lines: string[], ctx: FileParseContext): PendingLine[] {
    return lines.map((raw) => parseFileLine(raw, ctx));
}

/** Source id for terminal sidecar lines. */
export const SOURCE_TERMINAL = 'terminal';

/**
 * Parse terminal sidecar content (plain text lines) into PendingLine[] with source 'terminal'.
 * Used when loading a log that has a .terminal.log sidecar for the multi-source viewer.
 */
export function parseTerminalSidecarToPending(content: string): PendingLine[] {
    const lines = content.split(/\r?\n/).filter((s) => s.length > 0);
    return lines.map((raw) => ({
        text: linkifyUrls(linkifyHtml(ansiToHtml(raw))),
        isMarker: false,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
        source: SOURCE_TERMINAL,
    }));
}

/** Source id prefix for external log sidecars. */
export const SOURCE_EXTERNAL_PREFIX = 'external:';

/**
 * Derive the external-log label from a sidecar filename next to main log `basename.log`
 * (e.g. main `session.log`, sidecar `session.app.log` → `app`).
 */
export function externalSidecarLabelFromFileName(mainLogBase: string, sidecarFileName: string): string {
    if (sidecarFileName.startsWith(mainLogBase + '.') && sidecarFileName.endsWith('.log')) {
        return sidecarFileName.slice(mainLogBase.length + 1, -4);
    }
    return 'external';
}

/**
 * Parse external log sidecar content into PendingLine[] with source 'external:<label>'.
 * Lines may be prefixed with [label] in the file; we pass raw text to the viewer.
 */
export function parseExternalSidecarToPending(content: string, label: string): PendingLine[] {
    const sourceId = SOURCE_EXTERNAL_PREFIX + label;
    const lines = content.split(/\r?\n/).filter((s) => s.length > 0);
    return lines.map((raw) => ({
        text: linkifyUrls(linkifyHtml(escapeHtml(raw))),
        isMarker: false,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
        source: sourceId,
    }));
}

/**
 * Parse `basename.unified.jsonl` (one JSON object per line: source + text).
 * Uses the regular raw-line parser so markers/timestamps/categories/ANSI handling
 * match the normal multi-source viewer.
 */
export function parseUnifiedJsonlToPending(
    content: string,
    baseCtx: FileParseContext,
): { lines: PendingLine[]; sources: string[] } {
    const records: Array<{ source: string; text: string }> = [];
    const sourcesOrder: string[] = [];
    const seenSources = new Set<string>();

    for (const line of content.split(/\r?\n/)) {
        if (line.trim() === '') { continue; }
        let rec: unknown;
        try {
            rec = JSON.parse(line);
        } catch {
            continue;
        }
        const obj = rec as { source?: unknown; text?: unknown };
        if (typeof obj?.source !== 'string' || typeof obj?.text !== 'string') { continue; }
        if (!seenSources.has(obj.source)) {
            seenSources.add(obj.source);
            sourcesOrder.push(obj.source);
        }
        records.push({ source: obj.source, text: obj.text });
    }

    const out: Array<PendingLine | undefined> = new Array(records.length);
    const bySource = new Map<string, { indices: number[]; texts: string[] }>();

    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const group = bySource.get(r.source) ?? { indices: [], texts: [] };
        group.indices.push(i);
        group.texts.push(r.text);
        bySource.set(r.source, group);
    }

    for (const [source, group] of bySource.entries()) {
        const groupCtx: FileParseContext = { ...baseCtx, source };
        const parsed = parseRawLinesToPending(group.texts, groupCtx);
        for (let j = 0; j < group.indices.length; j++) {
            out[group.indices[j]] = parsed[j];
        }
    }

    return {
        lines: out.filter((x): x is PendingLine => x !== undefined),
        sources: sourcesOrder.length > 0 ? sourcesOrder : [SOURCE_DEBUG],
    };
}

/** Send pre-built PendingLine batches to the webview (used for unified JSONL load). */
export async function sendPendingLinesBatched(
    pending: readonly PendingLine[],
    postMessage: (msg: unknown) => void,
    seenCategories: Set<string>,
): Promise<void> {
    const batchSize = 500;
    const cats = new Set<string>();
    for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);
        for (const ln of batch) {
            if (!ln.isMarker) { cats.add(ln.category); }
        }
        postMessage({
            type: 'addLines',
            lines: batch,
            lineCount: Math.min(i + batchSize, pending.length),
        });
        if (i + batchSize < pending.length) {
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
