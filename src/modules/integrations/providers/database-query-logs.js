"use strict";
/**
 * Database query logs integration: at session end, either read an external
 * query log file (file mode) or scan the captured session log for inline
 * query blocks (parse mode). Writes a .queries.json sidecar.
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
exports.databaseQueryLogsProvider = void 0;
exports.parseQueryBlocks = parseQueryBlocks;
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const workspace_path_1 = require("../workspace-path");
/** Built-in regex for detecting SQL statement starts. */
const builtinSqlPattern = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE|TRUNCATE|EXPLAIN|WITH)\b/i;
/** Duration pattern: common ORM/log formats like "123ms", "1.5s", "Duration: 42ms". */
const durationPattern = /(?:duration|elapsed|took|time)[=:\s]*(\d+(?:\.\d+)?)\s*(ms|s)\b/i;
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('database');
}
/** Try to parse a JSON string as an object, returning undefined on failure. */
function tryParseJsonObject(line) {
    try {
        const obj = JSON.parse(line);
        return obj && typeof obj === 'object' ? obj : undefined;
    }
    catch {
        return undefined;
    }
}
/** Extract duration in ms from a line of text. */
function extractDuration(text) {
    const m = durationPattern.exec(text);
    if (!m) {
        return undefined;
    }
    const val = parseFloat(m[1]);
    return m[2] === 's' ? val * 1000 : val;
}
/**
 * Scan nearby lines (up to 5 above the query start) for a request ID.
 * Returns the first match or undefined.
 */
function findRequestId(lines, queryLineStart, requestIdRe) {
    const searchStart = Math.max(0, queryLineStart - 5);
    for (let i = queryLineStart; i >= searchStart; i--) {
        const m = requestIdRe.exec(lines[i]);
        if (m) {
            return m[1] ?? m[0];
        }
    }
    return undefined;
}
/**
 * Parse mode: scan captured session log lines for inline query blocks.
 * Uses queryBlockPattern (user regex) or built-in SQL detection.
 */
function parseQueryBlocks(lines, queryBlockPattern, requestIdPattern, maxQueries) {
    const blockRe = queryBlockPattern
        ? new RegExp(queryBlockPattern, 'i')
        : builtinSqlPattern;
    const requestIdRe = requestIdPattern
        ? new RegExp(requestIdPattern, 'i')
        : undefined;
    const queries = [];
    let i = 0;
    while (i < lines.length && queries.length < maxQueries) {
        if (!blockRe.test(lines[i])) {
            i++;
            continue;
        }
        const lineStart = i;
        const parts = [lines[i]];
        i++;
        // Continuation: lines starting with whitespace or common SQL
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !blockRe.test(lines[i])) {
            parts.push(lines[i]);
            i++;
        }
        const lineEnd = i - 1;
        const queryText = parts.join('\n').trim();
        if (!queryText) {
            continue;
        }
        const entry = { lineStart, lineEnd, queryText };
        entry.durationMs = extractDuration(lines[lineEnd]) ?? extractDuration(lines[Math.min(lineEnd + 1, lines.length - 1)]);
        if (requestIdRe) {
            entry.requestId = findRequestId(lines, lineStart, requestIdRe);
        }
        queries.push(entry);
    }
    return queries;
}
/** File mode: read external query log file (JSON lines). */
function readFileMode(context) {
    const cfg = context.config.integrationsDatabase;
    if (!cfg.queryLogPath) {
        return undefined;
    }
    try {
        const uri = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.queryLogPath);
        const raw = fs.readFileSync(uri.fsPath, 'utf-8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const queries = [];
        for (const line of lines.slice(-2000)) {
            const obj = tryParseJsonObject(line);
            if (obj) {
                queries.push(obj);
            }
        }
        if (queries.length === 0) {
            return undefined;
        }
        const sidecarContent = JSON.stringify({ queries }, null, 2);
        const payload = { sidecar: `${context.baseFileName}.queries.json`, count: queries.length };
        return [
            { kind: 'meta', key: 'database', payload },
            { kind: 'sidecar', filename: `${context.baseFileName}.queries.json`, content: sidecarContent, contentType: 'json' },
        ];
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.outputChannel.appendLine(`[database] Query log read failed: ${msg}`);
        return undefined;
    }
}
/** Parse mode: scan session log for inline query blocks. */
async function readParseMode(context) {
    const cfg = context.config.integrationsDatabase;
    try {
        const logContent = await vscode.workspace.fs.readFile(context.logUri);
        const text = Buffer.from(logContent).toString('utf-8');
        const lines = text.split(/\r?\n/);
        const maxQueries = cfg.maxQueriesPerLookup * 10;
        const queries = parseQueryBlocks(lines, cfg.queryBlockPattern, cfg.requestIdPattern, maxQueries);
        if (queries.length === 0) {
            return undefined;
        }
        const sidecarContent = JSON.stringify({ queries }, null, 2);
        const payload = { sidecar: `${context.baseFileName}.queries.json`, count: queries.length, mode: 'parse' };
        return [
            { kind: 'meta', key: 'database', payload },
            { kind: 'sidecar', filename: `${context.baseFileName}.queries.json`, content: sidecarContent, contentType: 'json' },
        ];
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.outputChannel.appendLine(`[database] Parse mode failed: ${msg}`);
        return undefined;
    }
}
exports.databaseQueryLogsProvider = {
    id: 'database',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        const cfg = context.config.integrationsDatabase;
        if (cfg.mode === 'file') {
            return readFileMode(context);
        }
        if (cfg.mode === 'parse') {
            return readParseMode(context);
        }
        return undefined;
    },
};
//# sourceMappingURL=database-query-logs.js.map