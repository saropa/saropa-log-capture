"use strict";
/**
 * File loading utilities for the log viewer.
 *
 * Parses historical log files into PendingLine objects for display
 * in the webview. Handles context header detection, category extraction,
 * marker detection, timestamp parsing, and async batch sending.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOURCE_DEBUG = exports.sendPendingLinesBatched = exports.parseUnifiedJsonlToPending = exports.parseExternalSidecarToPending = exports.externalSidecarLabelFromFileName = exports.parseBrowserSidecarToPending = exports.parseTerminalSidecarToPending = exports.SOURCE_BROWSER = exports.SOURCE_EXTERNAL_PREFIX = exports.SOURCE_TERMINAL = void 0;
exports.findHeaderEnd = findHeaderEnd;
exports.parseHeaderFields = parseHeaderFields;
exports.computeSessionMidnight = computeSessionMidnight;
exports.parseTimeToMs = parseTimeToMs;
exports.parseElapsedToMs = parseElapsedToMs;
exports.sendFileLines = sendFileLines;
exports.parseRawLinesToPending = parseRawLinesToPending;
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
var viewer_file_loader_sources_1 = require("./viewer-file-loader-sources");
Object.defineProperty(exports, "SOURCE_TERMINAL", { enumerable: true, get: function () { return viewer_file_loader_sources_1.SOURCE_TERMINAL; } });
Object.defineProperty(exports, "SOURCE_EXTERNAL_PREFIX", { enumerable: true, get: function () { return viewer_file_loader_sources_1.SOURCE_EXTERNAL_PREFIX; } });
Object.defineProperty(exports, "SOURCE_BROWSER", { enumerable: true, get: function () { return viewer_file_loader_sources_1.SOURCE_BROWSER; } });
Object.defineProperty(exports, "parseTerminalSidecarToPending", { enumerable: true, get: function () { return viewer_file_loader_sources_1.parseTerminalSidecarToPending; } });
Object.defineProperty(exports, "parseBrowserSidecarToPending", { enumerable: true, get: function () { return viewer_file_loader_sources_1.parseBrowserSidecarToPending; } });
Object.defineProperty(exports, "externalSidecarLabelFromFileName", { enumerable: true, get: function () { return viewer_file_loader_sources_1.externalSidecarLabelFromFileName; } });
Object.defineProperty(exports, "parseExternalSidecarToPending", { enumerable: true, get: function () { return viewer_file_loader_sources_1.parseExternalSidecarToPending; } });
Object.defineProperty(exports, "parseUnifiedJsonlToPending", { enumerable: true, get: function () { return viewer_file_loader_sources_1.parseUnifiedJsonlToPending; } });
Object.defineProperty(exports, "sendPendingLinesBatched", { enumerable: true, get: function () { return viewer_file_loader_sources_1.sendPendingLinesBatched; } });
/** Stream source id for multi-source filtering (debug = DAP, terminal = terminal sidecar, etc.). */
exports.SOURCE_DEBUG = 'debug';
/**
 * Find where the context header ends in a log file.
 * The header (session metadata) is terminated by a line of 10+ '=' characters.
 * Returns the index of the first content line, or 0 if no header is found.
 * Only scans the first 50 lines to avoid false matches deep in log content.
 */
function findHeaderEnd(lines) {
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
function parseHeaderFields(lines) {
    const result = {};
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
        if (!inHeader) {
            continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            continue;
        }
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key) {
            result[key] = value;
        }
    }
    return result;
}
/**
 * Compute epoch ms for midnight (local time) of the given ISO date.
 * Returns 0 if the date string is invalid or empty — timestamps will remain 0.
 */
function computeSessionMidnight(isoDate) {
    if (!isoDate) {
        return 0;
    }
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) {
        return 0;
    }
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}
/** Parse a time string (HH:MM:SS or HH:MM:SS.mmm) into epoch ms. */
function parseTimeToMs(timeStr, midnightMs) {
    if (midnightMs === 0) {
        return 0;
    }
    const parts = timeStr.split(/[:.]/);
    if (parts.length < 3) {
        return 0;
    }
    const h = Number.parseInt(parts[0], 10);
    const m = Number.parseInt(parts[1], 10);
    const s = Number.parseInt(parts[2], 10);
    const ms = parts.length > 3 ? Number.parseInt(parts[3], 10) : 0;
    return midnightMs + (h * 3600000) + (m * 60000) + (s * 1000) + ms;
}
/** Parse elapsed prefix "+125ms", "+1.5s", "+15s" into ms. Returns undefined if not matched. */
function parseElapsedToMs(elapsedStr) {
    const m = /^\+(\d+(?:\.\d+)?)(ms|s)$/.exec(elapsedStr);
    if (!m) {
        return undefined;
    }
    const val = Number.parseFloat(m[1]);
    if (!Number.isFinite(val) || val < 0) {
        return undefined;
    }
    return m[2] === 's' ? Math.round(val * 1000) : Math.round(val);
}
/**
 * Send parsed file lines to the webview in async batches.
 * Yields 10ms between batches so the webview can process each one without freezing.
 * After all batches, sends discovered categories to populate the filter dropdown.
 */
async function sendFileLines(lines, ctx, postMessage, seenCategories) {
    const batchSize = 500;
    const cats = new Set();
    for (let i = 0; i < lines.length; i += batchSize) {
        const chunk = lines.slice(i, i + batchSize);
        const batch = chunk.map((line) => parseFileLine(line, ctx));
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
/**
 * Parse a raw log file line into a PendingLine for the webview.
 * Detects markers, session boundaries, and extracts timestamps, optional [+Nms] elapsed, and category.
 */
function parseFileLine(raw, ctx) {
    const src = ctx.source ?? exports.SOURCE_DEBUG;
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
function buildMarkerLine(text, source) {
    return {
        text: (0, ansi_1.escapeHtml)(text),
        isMarker: true,
        lineCount: 0,
        category: 'console',
        timestamp: 0,
        ...(source ? { source } : {}),
    };
}
/** Build a PendingLine for a regular log line. Converts ANSI codes to HTML and linkifies paths. */
function buildFileLine(opts) {
    return {
        text: (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(opts.text))),
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
function parseRawLinesToPending(lines, ctx) {
    return lines.map((raw) => parseFileLine(raw, ctx));
}
//# sourceMappingURL=viewer-file-loader.js.map