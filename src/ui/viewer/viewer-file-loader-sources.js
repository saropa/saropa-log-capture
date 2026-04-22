"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_BROWSER = exports.SOURCE_EXTERNAL_PREFIX = exports.SOURCE_TERMINAL = void 0;
exports.parseTerminalSidecarToPending = parseTerminalSidecarToPending;
exports.externalSidecarLabelFromFileName = externalSidecarLabelFromFileName;
exports.sourceTagForGroupMember = sourceTagForGroupMember;
exports.parseExternalSidecarToPending = parseExternalSidecarToPending;
exports.parseUnifiedJsonlToPending = parseUnifiedJsonlToPending;
exports.parseBrowserSidecarToPending = parseBrowserSidecarToPending;
exports.sendPendingLinesBatched = sendPendingLinesBatched;
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
const timestamp_parser_1 = require("../../modules/timeline/timestamp-parser");
const viewer_file_loader_1 = require("./viewer-file-loader");
/** Source id for terminal sidecar lines. */
exports.SOURCE_TERMINAL = 'terminal';
/** Source id prefix for external log sidecars. */
exports.SOURCE_EXTERNAL_PREFIX = 'external:';
/** Source id for browser console sidecar lines. */
exports.SOURCE_BROWSER = 'browser';
function parseTerminalSidecarToPending(content) {
    const lines = content.split(/\r?\n/).filter((s) => s.length > 0);
    return lines.map((raw) => ({
        text: (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(raw))),
        rawText: raw,
        isMarker: false,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
        source: exports.SOURCE_TERMINAL,
    }));
}
function externalSidecarLabelFromFileName(mainLogBase, sidecarFileName) {
    if (sidecarFileName.startsWith(mainLogBase + '.') && sidecarFileName.endsWith('.log')) {
        return sidecarFileName.slice(mainLogBase.length + 1, -4);
    }
    return 'external';
}
/**
 * Pick a short, stable source-tag label for a session-group member that was NOT auto-picked
 * up as a sidecar of the primary (i.e. filenames don't share a basename prefix).
 *
 * Rules, in order:
 *   1. If the filename follows the sidecar convention against a known mainBase, return that label
 *      (e.g. `Session.logcat.log` with `mainBase=Session` \u2192 `logcat`). Preserves parity with
 *      auto-merged sidecars.
 *   2. If the filename ends with `.logcat.log`, `.drift-advisor.log`, or similar multi-segment
 *      suffixes, return the segment just before `.log`.
 *   3. Otherwise, use the filename stem (without the trailing `.log`/`.txt`/`.json`) truncated to
 *      a reasonable length.
 *
 * The returned label is fed to `parseExternalSidecarToPending(content, label)`, which tags every
 * line with source id `external:<label>` so the existing source-tag filter picks it up.
 */
function sourceTagForGroupMember(mainLogBase, memberFileName) {
    // Rule 1: standard sidecar pattern against the main log base.
    if (memberFileName.startsWith(mainLogBase + '.') && memberFileName.endsWith('.log')) {
        return memberFileName.slice(mainLogBase.length + 1, -4);
    }
    // Rule 2: `.something.log` \u2014 grab the segment before `.log`.
    const lower = memberFileName.toLowerCase();
    if (lower.endsWith('.log')) {
        const stem = memberFileName.slice(0, -4);
        const lastDot = stem.lastIndexOf('.');
        if (lastDot > 0) {
            return stem.slice(lastDot + 1);
        }
        return clampLabel(stem);
    }
    // Rule 3: stem of any other extension.
    const extMatch = memberFileName.match(/\.(log|txt|md|csv|json|jsonl|html)$/i);
    const stem = extMatch ? memberFileName.slice(0, extMatch.index) : memberFileName;
    return clampLabel(stem);
}
/** Keep labels short so the source-filter UI doesn't overflow. */
function clampLabel(raw) {
    const trimmed = raw.trim().replace(/[^A-Za-z0-9._-]+/g, '-');
    if (trimmed.length === 0) {
        return 'external';
    }
    return trimmed.length > 32 ? trimmed.slice(0, 32) : trimmed;
}
function parseExternalSidecarToPending(content, label) {
    const sourceId = exports.SOURCE_EXTERNAL_PREFIX + label;
    const lines = content.split(/\r?\n/).filter((s) => s.length > 0);
    return lines.map((raw) => {
        const extracted = (0, timestamp_parser_1.extractTimestamp)(raw);
        return {
            text: (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.escapeHtml)(raw))),
            rawText: raw,
            isMarker: false,
            lineCount: 0,
            category: 'console',
            timestamp: extracted?.timestamp ?? 0,
            source: sourceId,
        };
    });
}
function parseUnifiedJsonlToPending(content, baseCtx) {
    const records = [];
    const sourcesOrder = [];
    const seenSources = new Set();
    for (const line of content.split(/\r?\n/)) {
        if (line.trim() === '') {
            continue;
        }
        try {
            const obj = JSON.parse(line);
            if (typeof obj?.source !== 'string' || typeof obj?.text !== 'string') {
                continue;
            }
            if (!seenSources.has(obj.source)) {
                seenSources.add(obj.source);
                sourcesOrder.push(obj.source);
            }
            records.push({ source: obj.source, text: obj.text });
        }
        catch {
            // ignore invalid jsonl rows
        }
    }
    const out = new Array(records.length);
    const bySource = new Map();
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const group = bySource.get(r.source) ?? { indices: [], texts: [] };
        group.indices.push(i);
        group.texts.push(r.text);
        bySource.set(r.source, group);
    }
    for (const [source, group] of bySource.entries()) {
        const parsed = (0, viewer_file_loader_1.parseRawLinesToPending)(group.texts, { ...baseCtx, source });
        for (let j = 0; j < group.indices.length; j++) {
            out[group.indices[j]] = parsed[j];
        }
    }
    return { lines: out.filter((x) => x !== undefined), sources: sourcesOrder.length > 0 ? sourcesOrder : [viewer_file_loader_1.SOURCE_DEBUG] };
}
/**
 * Parse a .browser.json sidecar into PendingLine[] for the main viewer.
 * Accepts a JSON array of browser events or `{ events: [...] }` wrapper.
 * Each event becomes a line formatted as `[level] message (url:line)`.
 */
function parseBrowserSidecarToPending(content) {
    let items;
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            items = parsed;
        }
        else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.events)) {
            items = parsed.events;
        }
        else {
            return [];
        }
    }
    catch {
        return [];
    }
    const result = [];
    for (const raw of items) {
        if (typeof raw !== 'object' || raw === null) {
            continue;
        }
        const obj = raw;
        const message = typeof obj.message === 'string' ? obj.message : (typeof obj.text === 'string' ? obj.text : '');
        if (!message) {
            continue;
        }
        const level = typeof obj.level === 'string' ? obj.level : (typeof obj.type === 'string' ? obj.type : 'log');
        const ts = typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp) ? obj.timestamp : 0;
        let formatted = `[${level}] ${message}`;
        if (typeof obj.url === 'string' && obj.url) {
            const suffix = typeof obj.lineNumber === 'number' ? `:${obj.lineNumber}` : '';
            formatted += ` (${obj.url}${suffix})`;
        }
        result.push({
            text: (0, ansi_1.escapeHtml)(formatted),
            rawText: formatted,
            isMarker: false,
            lineCount: 0,
            category: 'console',
            timestamp: ts,
            source: exports.SOURCE_BROWSER,
        });
    }
    return result;
}
async function sendPendingLinesBatched(pending, postMessage, seenCategories) {
    const batchSize = 500;
    const cats = new Set();
    for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);
        for (const ln of batch) {
            if (!ln.isMarker) {
                cats.add(ln.category);
            }
        }
        postMessage({ type: 'addLines', lines: batch, lineCount: Math.min(i + batchSize, pending.length) });
        if (i + batchSize < pending.length) {
            await new Promise((r) => setTimeout(r, 10));
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
//# sourceMappingURL=viewer-file-loader-sources.js.map