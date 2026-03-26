"use strict";
/**
 * Helper functions for session history tree items.
 *
 * Handles header/footer parsing, line count extraction,
 * and tree item description/tooltip formatting.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHeader = parseHeader;
exports.formatDuration = formatDuration;
exports.formatCount = formatCount;
exports.buildDescription = buildDescription;
exports.buildTooltip = buildTooltip;
const vscode = __importStar(require("vscode"));
const session_history_grouping_1 = require("./session-history-grouping");
const session_display_1 = require("./session-display");
const session_severity_counts_1 = require("./session-severity-counts");
/** Regex to extract line count from the SESSION END footer. */
const footerCountRe = /===\s*SESSION END\b.*?(\d[\d,]*)\s+lines\s*===/;
/** Regex to extract ISO date from the SESSION END footer. */
const footerDateRe = /===\s*SESSION END[\s\u2014\u2013-]+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/;
/** Parse header fields, footer line count, and timestamp presence from a log file. Skips severity scan when counts are already cached in the sidecar. */
async function parseHeader(uri, base, skipSeverityScan = false) {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf-8');
        const headerEnd = text.indexOf('==================');
        const block = headerEnd > 0 ? text.slice(0, headerEnd) : text.slice(0, 800);
        const hasTimestamps = detectTimestamps(text, headerEnd);
        const lineCount = parseLineCount(text);
        const fields = extractFields(block);
        const durationMs = parseDuration(text, fields.date);
        if (skipSeverityScan) {
            return { ...base, ...fields, hasTimestamps, lineCount, durationMs };
        }
        const sev = (0, session_severity_counts_1.countSeverities)((0, session_severity_counts_1.extractBody)(text));
        return {
            ...base, ...fields, hasTimestamps, lineCount, durationMs,
            errorCount: sev.errors, warningCount: sev.warnings, perfCount: sev.perfs,
            anrCount: sev.anrs > 0 ? sev.anrs : undefined,
            fwCount: sev.frameworks, infoCount: sev.infos,
        };
    }
    catch {
        return base;
    }
}
/** Check if the first content line after the header has a timestamp prefix. */
function detectTimestamps(text, headerEnd) {
    if (headerEnd <= 0) {
        return /^\[[\d:.]+\]/.test(text);
    }
    const after = text.slice(headerEnd).replace(/^=+\s*\n?\s*/, '');
    const firstLine = after.split('\n').find(l => l.trim().length > 0);
    return firstLine ? /^\[[\d:.]+\]/.test(firstLine) : false;
}
/**
 * Extract line count: prefer footer (exact), fall back to newline count.
 * The footer is written by LogSession.stop(): `=== SESSION END — {date} — N lines ===`
 */
function parseLineCount(text) {
    const footerMatch = text.match(footerCountRe);
    if (footerMatch) {
        return parseInt(footerMatch[1].replace(/,/g, ''), 10);
    }
    // Fallback: count newlines after the header
    const headerEnd = text.indexOf('==================');
    const bodyStart = headerEnd > 0
        ? text.indexOf('\n', text.indexOf('\n', headerEnd) + 1) + 1
        : 0;
    const body = text.slice(bodyStart);
    if (body.length === 0) {
        return 0;
    }
    let count = 0;
    for (let i = 0; i < body.length; i++) {
        if (body[i] === '\n') {
            count++;
        }
    }
    return count;
}
function parseDuration(text, startDate) {
    if (!startDate) {
        return undefined;
    }
    const startMs = new Date(startDate).getTime();
    if (!Number.isFinite(startMs)) {
        return undefined;
    }
    const endMatch = text.match(footerDateRe);
    if (!endMatch) {
        return undefined;
    }
    const endMs = new Date(endMatch[1]).getTime();
    if (!Number.isFinite(endMs) || endMs <= startMs) {
        return undefined;
    }
    return endMs - startMs;
}
/** Format a duration in ms as a human-readable string. */
function formatDuration(ms) {
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
function extractFields(block) {
    const result = {};
    const dateMatch = block.match(/^Date:\s+(.+)$/m);
    if (dateMatch) {
        result.date = dateMatch[1].trim();
    }
    const projMatch = block.match(/^Project:\s+(.+)$/m);
    if (projMatch) {
        result.project = projMatch[1].trim();
    }
    const adapterMatch = block.match(/^Debug Adapter:\s+(.+)$/m);
    if (adapterMatch) {
        result.adapter = adapterMatch[1].trim();
    }
    return result;
}
/** Format a number with locale-aware thousands separators. */
function formatCount(n) {
    return n.toLocaleString('en-US');
}
/** Build the tree item description string. */
function buildDescription(item, timeOnly, isActive) {
    const parts = [];
    if (item.adapter) {
        parts.push(item.adapter);
    }
    const timeStr = timeOnly ? (0, session_display_1.formatMtimeTimeOnly)(item.mtime) : (0, session_display_1.formatMtime)(item.mtime);
    const rel = (0, session_display_1.formatRelativeTime)(item.mtime);
    parts.push(rel ? `${timeStr} ${rel}` : timeStr);
    if (item.lineCount !== undefined) {
        const countStr = `${formatCount(item.lineCount)} lines`;
        parts.push(isActive ? `${countStr} ●` : countStr);
    }
    if (item.durationMs) {
        parts.push(formatDuration(item.durationMs));
    }
    parts.push((0, session_history_grouping_1.formatSize)(item.size));
    if (item.anrCount) {
        parts.push(`ANR: ${item.anrCount}`);
    }
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
function buildTooltip(item) {
    const parts = [item.filename];
    if (item.date) {
        parts.push(`Date: ${item.date}`);
    }
    parts.push(`Modified: ${(0, session_display_1.formatMtime)(item.mtime)}`);
    if (item.project) {
        parts.push(`Project: ${item.project}`);
    }
    if (item.adapter) {
        parts.push(`Adapter: ${item.adapter}`);
    }
    if (item.lineCount !== undefined) {
        parts.push(`Lines: ${formatCount(item.lineCount)}`);
    }
    if (item.durationMs) {
        parts.push(`Duration: ${formatDuration(item.durationMs)}`);
    }
    parts.push(`Size: ${(0, session_history_grouping_1.formatSize)(item.size)}`);
    if (item.anrCount) {
        parts.push(`ANR patterns: ${item.anrCount}`);
    }
    parts.push(`Timestamps: ${item.hasTimestamps ? 'Yes' : 'No'}`);
    return parts.join('\n');
}
//# sourceMappingURL=session-history-helpers.js.map