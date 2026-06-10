/**
 * Helper functions for session history tree items.
 *
 * Handles header/footer parsing, line count extraction,
 * and tree item description/tooltip formatting.
 */

import * as vscode from 'vscode';
import { open } from 'node:fs/promises';
import { SessionMetadata, formatSize } from './session-history-grouping';
import { formatMtime, formatMtimeTimeOnly, formatRelativeTime } from './session-display';
/** Regex to extract line count from the SESSION END footer. */
const footerCountRe = /===\s*SESSION END\b.*?(\d[\d,]*)\s+lines\s*===/;
/** Regex to extract ISO date from the SESSION END footer. */
const footerDateRe = /===\s*SESSION END[\s\u2014\u2013-]+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/;

/* Above this size the blocking list-refresh pass reads only the head + tail of the file
   instead of the whole body. A `reports/` folder can hold multi-hundred-MB sidecars
   (117 MB l10n_failures.json was observed); reading them in full on every refresh
   exhausted memory and the whole fetch fell into its catch-all, blanking the panel
   ("No sessions found"). The header (Date/Project/Adapter) sits in the head and the
   SESSION END footer (line count + end timestamp) sits in the tail, so a head+tail
   read recovers everything the list needs without ever materializing the body. Files
   at or below this size keep the exact whole-file parse (newline-count fallback intact). */
const quickScanThresholdBytes = 2 * 1024 * 1024;
const headScanBytes = 64 * 1024;
const tailScanBytes = 64 * 1024;

/**
 * Parse header fields, footer line count, and timestamp presence from a log file.
 *
 * **Never scans the body for severities.** The list panel must display fast on first
 * paint (large log files were blocking the streaming path on a multi-MB body scan).
 * Severity counts are produced separately by the deferred worker \u2014 see
 * `session-severity-scan.ts` \u2014 and posted to the webview as a follow-up update.
 *
 * Reads the whole file because the footer (line count + end timestamp) lives at
 * the tail. Trade-off: a single fs.readFile is cheaper than seek+tail, and the
 * file is hot for the deferred scan that follows.
 */
export async function parseHeader(uri: vscode.Uri, base: SessionMetadata): Promise<SessionMetadata> {
    try {
        // Large files get the head+tail quick scan; everything else keeps the exact whole-file parse.
        if (base.size > quickScanThresholdBytes) {
            return await parseHeaderQuick(uri, base);
        }
        const raw = await vscode.workspace.fs.readFile(uri);
        return parseHeaderFromText(Buffer.from(raw).toString('utf-8'), base);
    } catch {
        return base;
    }
}

/** Parse header/footer fields from the full file text (small-file path). */
function parseHeaderFromText(text: string, base: SessionMetadata): SessionMetadata {
    const headerEnd = text.indexOf('==================');
    const block = headerEnd > 0 ? text.slice(0, headerEnd) : text.slice(0, 800);
    const hasTimestamps = detectTimestamps(text, headerEnd);
    const lineCount = parseLineCount(text);
    const fields = extractFields(block);
    const durationMs = parseDuration(text, fields.date);
    return { ...base, ...fields, hasTimestamps, lineCount, durationMs };
}

/**
 * Quick scan for large files: read only the head (header block + first content line)
 * and the tail (SESSION END footer). The exact line count is available only when the
 * footer is present — a footerless giant file (e.g. a raw JSON report) leaves lineCount
 * undefined here; the deferred worker fills counts it can derive. Never materializes the
 * body, so a 117 MB file costs ~128 KB of reads instead of 117 MB.
 */
async function parseHeaderQuick(uri: vscode.Uri, base: SessionMetadata): Promise<SessionMetadata> {
    const { head, tail } = await readHeadAndTail(uri.fsPath, headScanBytes, tailScanBytes);
    const headerEnd = head.indexOf('==================');
    const block = headerEnd > 0 ? head.slice(0, headerEnd) : head.slice(0, 800);
    const fields = extractFields(block);
    const hasTimestamps = detectTimestamps(head, headerEnd);
    const lineCount = footerLineCount(tail);
    const durationMs = parseDuration(tail, fields.date);
    return { ...base, ...fields, hasTimestamps, lineCount, durationMs };
}

/**
 * Read the first `headBytes` and last `tailBytes` of a file via a positional read —
 * vscode.workspace.fs.readFile has no range API, so node fs is the only way to avoid
 * loading the whole body. A torn multibyte char at a chunk edge decodes to a single
 * replacement char; the header and footer lines sit well inside their chunk, so the
 * parsed fields are unaffected.
 */
async function readHeadAndTail(
    fsPath: string, headBytes: number, tailBytes: number,
): Promise<{ head: string; tail: string }> {
    const handle = await open(fsPath, 'r');
    try {
        const { size } = await handle.stat();
        const headLen = Math.min(headBytes, size);
        const headBuf = Buffer.alloc(headLen);
        await handle.read(headBuf, 0, headLen, 0);
        const tailLen = Math.min(tailBytes, size);
        const tailBuf = Buffer.alloc(tailLen);
        await handle.read(tailBuf, 0, tailLen, size - tailLen);
        return { head: headBuf.toString('utf-8'), tail: tailBuf.toString('utf-8') };
    } finally {
        await handle.close();
    }
}

/** Check if the first content line after the header has a timestamp prefix. */
function detectTimestamps(text: string, headerEnd: number): boolean {
    if (headerEnd <= 0) { return /^\[[\d:.]+\]/.test(text); }
    const after = text.slice(headerEnd).replace(/^=+\s*\n?\s*/, '');
    const firstLine = after.split('\n').find(l => l.trim().length > 0);
    return firstLine ? /^\[[\d:.]+\]/.test(firstLine) : false;
}

/**
 * Extract line count: prefer footer (exact), fall back to newline count.
 * The footer is written by LogSession.stop(): `=== SESSION END — {date} — N lines ===`
 */
/** Exact line count from the SESSION END footer, or undefined when no footer is present.
 *  The quick-scan path uses this directly (no body to count newlines in). */
function footerLineCount(text: string): number | undefined {
    const footerMatch = text.match(footerCountRe);
    return footerMatch ? parseInt(footerMatch[1].replace(/,/g, ''), 10) : undefined;
}

function parseLineCount(text: string): number {
    const fromFooter = footerLineCount(text);
    if (fromFooter !== undefined) {
        return fromFooter;
    }
    // Fallback: count newlines after the header
    const headerEnd = text.indexOf('==================');
    const bodyStart = headerEnd > 0
        ? text.indexOf('\n', text.indexOf('\n', headerEnd) + 1) + 1
        : 0;
    const body = text.slice(bodyStart);
    if (body.length === 0) { return 0; }
    let count = 0;
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '\n') { count++; }
    }
    return count;
}

function parseDuration(text: string, startDate: string | undefined): number | undefined {
    if (!startDate) { return undefined; }
    const startMs = new Date(startDate).getTime();
    if (!Number.isFinite(startMs)) { return undefined; }
    const endMatch = text.match(footerDateRe);
    if (!endMatch) { return undefined; }
    const endMs = new Date(endMatch[1]).getTime();
    if (!Number.isFinite(endMs) || endMs <= startMs) { return undefined; }
    return endMs - startMs;
}

/** Format a duration in ms as a human-readable string. */
export function formatDuration(ms: number): string {
    if (ms >= 3_600_000) {
        const h = Math.floor(ms / 3_600_000);
        const m = Math.floor((ms % 3_600_000) / 60_000);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    if (ms >= 60_000) {
        const m = Math.floor(ms / 60_000);
        const s = Math.floor((ms % 60_000) / 1000);
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    return `${Math.round(ms / 1000)}s`;
}

function extractFields(block: string): Partial<Pick<SessionMetadata, 'date' | 'project' | 'adapter'>> {
    const result: Record<string, string> = {};
    const dateMatch = block.match(/^Date:\s+(.+)$/m);
    if (dateMatch) { result.date = dateMatch[1].trim(); }
    const projMatch = block.match(/^Project:\s+(.+)$/m);
    if (projMatch) { result.project = projMatch[1].trim(); }
    const adapterMatch = block.match(/^Debug Adapter:\s+(.+)$/m);
    if (adapterMatch) { result.adapter = adapterMatch[1].trim(); }
    return result;
}

/** Format a number with locale-aware thousands separators. */
export function formatCount(n: number): string {
    return n.toLocaleString('en-US');
}

/** Build the tree item description string. */
export function buildDescription(item: SessionMetadata, timeOnly: boolean, isActive: boolean): string {
    const parts: string[] = [];
    if (item.adapter) { parts.push(item.adapter); }
    const timeStr = timeOnly ? formatMtimeTimeOnly(item.mtime) : formatMtime(item.mtime);
    const rel = formatRelativeTime(item.mtime);
    parts.push(rel ? `${timeStr} ${rel}` : timeStr);
    if (item.lineCount !== undefined) {
        const countStr = `${formatCount(item.lineCount)} lines`;
        parts.push(isActive ? `${countStr} ●` : countStr);
    }
    if (item.durationMs) { parts.push(formatDuration(item.durationMs)); }
    parts.push(formatSize(item.size));
    if (item.anrCount) { parts.push(`ANR: ${item.anrCount}`); }
    if (item.tags && item.tags.length > 0) {
        parts.push(item.tags.map(t => `#${t}`).join(' '));
    }
    if (item.autoTags && item.autoTags.length > 0) {
        parts.push(item.autoTags.map(t => `~${t}`).join(' '));
    }
    if (item.correlationTags && item.correlationTags.length > 0) {
        parts.push(item.correlationTags.slice(0, 3).map(t => `@${t}`).join(' '));
    }
    return parts.join(' · ');
}

/** Build the tree item tooltip string. */
export function buildTooltip(item: SessionMetadata): string {
    const parts = [item.filename];
    if (item.date) { parts.push(`Date: ${item.date}`); }
    parts.push(`Modified: ${formatMtime(item.mtime)}`);
    if (item.project) { parts.push(`Project: ${item.project}`); }
    if (item.adapter) { parts.push(`Adapter: ${item.adapter}`); }
    if (item.lineCount !== undefined) {
        parts.push(`Lines: ${formatCount(item.lineCount)}`);
    }
    if (item.durationMs) { parts.push(`Duration: ${formatDuration(item.durationMs)}`); }
    parts.push(`Size: ${formatSize(item.size)}`);
    if (item.anrCount) { parts.push(`ANR patterns: ${item.anrCount}`); }
    parts.push(`Timestamps: ${item.hasTimestamps ? 'Yes' : 'No'}`);
    return parts.join('\n');
}
