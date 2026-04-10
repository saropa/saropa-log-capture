"use strict";
/**
 * Export formats: CSV, JSON, JSONL. Parses log lines to extract timestamp, category, level, and message.
 * Invoked by export commands (commands-export) and session panel export actions.
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
exports.exportToCsv = exportToCsv;
exports.exportToJson = exportToJson;
exports.exportToJsonl = exportToJsonl;
exports.escapeCsvField = escapeCsvField;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const level_classifier_1 = require("../analysis/level-classifier");
const config_1 = require("../config/config");
/**
 * Export a log file to CSV format.
 */
async function exportToCsv(logUri) {
    const parsed = await parseLogFile(logUri);
    const csvPath = logUri.fsPath.replace(/\.log$/, '.csv');
    const csvUri = vscode.Uri.file(csvPath);
    const lines = ['timestamp,category,level,line_number,message'];
    for (const entry of parsed.entries) {
        lines.push(formatCsvRow(entry));
    }
    await vscode.workspace.fs.writeFile(csvUri, Buffer.from(lines.join('\n'), 'utf-8'));
    return csvUri;
}
/**
 * Export a log file to JSON format (array of objects).
 */
async function exportToJson(logUri) {
    const parsed = await parseLogFile(logUri);
    const jsonPath = logUri.fsPath.replace(/\.log$/, '.json');
    const jsonUri = vscode.Uri.file(jsonPath);
    const content = JSON.stringify(parsed.entries, null, 2);
    await vscode.workspace.fs.writeFile(jsonUri, Buffer.from(content, 'utf-8'));
    return jsonUri;
}
/**
 * Export a log file to JSONL format (line-delimited JSON).
 */
async function exportToJsonl(logUri) {
    const parsed = await parseLogFile(logUri);
    const jsonlPath = logUri.fsPath.replace(/\.log$/, '.jsonl');
    const jsonlUri = vscode.Uri.file(jsonlPath);
    const lines = parsed.entries.map(entry => JSON.stringify(entry));
    await vscode.workspace.fs.writeFile(jsonlUri, Buffer.from(lines.join('\n'), 'utf-8'));
    return jsonlUri;
}
/**
 * Parse a log file into structured entries.
 */
async function parseLogFile(logUri) {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const cfg = (0, config_1.getConfig)();
    const strict = cfg.levelDetection === 'strict';
    const stderrTreatAsError = cfg.stderrTreatAsError;
    const { headerLines, bodyLines, bodyStartIndex } = splitHeader(lines);
    const sessionStart = extractSessionStart(headerLines);
    const entries = [];
    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        if (!line.trim()) {
            continue;
        }
        // Skip markers and session end
        if (line.startsWith('---') || line.startsWith('===')) {
            continue;
        }
        const entry = parseLine(line, bodyStartIndex + i + 1, { sessionStart, strict, stderrTreatAsError });
        if (entry) {
            entries.push(entry);
        }
    }
    return { entries, sessionStart };
}
/**
 * Split header from body at the divider line.
 */
function splitHeader(lines) {
    const divider = lines.findIndex(l => l.startsWith('=================='));
    if (divider < 0) {
        return { headerLines: [], bodyLines: lines, bodyStartIndex: 0 };
    }
    return {
        headerLines: lines.slice(0, divider + 1),
        bodyLines: lines.slice(divider + 1),
        bodyStartIndex: divider + 1,
    };
}
/**
 * Extract session start timestamp from header.
 */
function extractSessionStart(headerLines) {
    for (const line of headerLines) {
        const match = line.match(/^Date:\s+(.+)$/);
        if (match) {
            return match[1].trim();
        }
    }
    return null;
}
/**
 * Parse a single log line into a LogEntry.
 * Format: [HH:MM:SS.mmm] [category] message
 * Or:     [category] message (no timestamp)
 */
function parseLine(line, lineNumber, opts) {
    const clean = (0, ansi_1.stripAnsi)(line);
    const { sessionStart, strict, stderrTreatAsError } = opts;
    // Try format with timestamp: [HH:MM:SS.mmm] [category] message
    const withTs = clean.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+\[(\w+)\]\s+(.*)$/);
    if (withTs) {
        const timestamp = buildFullTimestamp(withTs[1], sessionStart);
        const category = withTs[2];
        const message = withTs[3];
        return {
            lineNumber,
            timestamp,
            category,
            level: (0, level_classifier_1.classifyLevel)(message ?? '', category, strict, stderrTreatAsError),
            message,
        };
    }
    // Try format without timestamp: [category] message
    const noTs = clean.match(/^\[(\w+)\]\s+(.*)$/);
    if (noTs) {
        const category = noTs[1];
        const message = noTs[2];
        return {
            lineNumber,
            timestamp: null,
            category,
            level: (0, level_classifier_1.classifyLevel)(message ?? '', category, strict, stderrTreatAsError),
            message,
        };
    }
    // Fallback: treat entire line as message
    return {
        lineNumber,
        timestamp: null,
        category: 'unknown',
        level: (0, level_classifier_1.classifyLevel)(clean, 'unknown', strict, stderrTreatAsError),
        message: clean,
    };
}
/**
 * Build a full ISO timestamp from time-only and session start date.
 */
function buildFullTimestamp(timeStr, sessionStart) {
    if (!sessionStart) {
        return timeStr;
    }
    // Extract date portion from session start (ISO format)
    const dateMatch = sessionStart.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
        // Convert HH:MM:SS.mmm to ISO time format
        return `${dateMatch[1]}T${timeStr}Z`;
    }
    return timeStr;
}
/**
 * Format a LogEntry as a CSV row.
 */
function formatCsvRow(entry) {
    const ts = entry.timestamp ?? '';
    const msg = escapeCsvField(entry.message);
    return `${ts},${entry.category},${entry.level},${entry.lineNumber},${msg}`;
}
/**
 * Escape a field for CSV (quote if contains comma, quote, or newline).
 * Exported for use by insights-export-formats and tests.
 */
function escapeCsvField(value) {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
//# sourceMappingURL=export-formats.js.map