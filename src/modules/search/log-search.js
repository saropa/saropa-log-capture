"use strict";
/**
 * Cross-session log search. Searches across all log files in the reports directory.
 * Invoked by viewer Find in Files (searchLogFilesConcurrent) and openLogAtLine.
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
exports.searchLogFiles = searchLogFiles;
exports.searchLogFilesConcurrent = searchLogFilesConcurrent;
exports.openLogAtLine = openLogAtLine;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const DEFAULT_MAX_RESULTS = 500;
const DEFAULT_MAX_PER_FILE = 50;
/**
 * Search across all log files in the workspace.
 * Returns matches grouped by file with line numbers.
 */
async function searchLogFiles(query, options = {}) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return { query, matches: [], totalFiles: 0, filesWithMatches: 0 };
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    const maxPerFile = options.maxResultsPerFile ?? DEFAULT_MAX_PER_FILE;
    const matches = [];
    let totalFiles = 0;
    let filesWithMatches = 0;
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const tracked = await (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
    const logFiles = tracked
        .map(rel => vscode.Uri.joinPath(logDir, rel))
        .sort((a, b) => b.fsPath.localeCompare(a.fsPath));
    // Build search pattern
    const pattern = buildPattern(query, options);
    if (!pattern) {
        return { query, matches: [], totalFiles: 0, filesWithMatches: 0 };
    }
    // Search each file
    for (const uri of logFiles) {
        if (matches.length >= maxResults) {
            break;
        }
        totalFiles++;
        const fileMatches = await searchFile(uri, pattern, maxPerFile);
        if (fileMatches.length > 0) {
            filesWithMatches++;
            const remaining = maxResults - matches.length;
            matches.push(...fileMatches.slice(0, remaining));
        }
    }
    return { query, matches, totalFiles, filesWithMatches };
}
/** Build a RegExp pattern from the query string. */
function buildPattern(query, options) {
    if (!query || query.length === 0) {
        return undefined;
    }
    try {
        const flags = options.caseSensitive ? 'g' : 'gi';
        if (options.useRegex) {
            return new RegExp(query, flags);
        }
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
        return new RegExp(pattern, flags);
    }
    catch {
        return undefined;
    }
}
/** Search a single file and return matches. */
async function searchFile(uri, pattern, maxMatches) {
    const matches = [];
    const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(data).toString('utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
            const line = lines[i];
            // Reset lastIndex for global regex
            pattern.lastIndex = 0;
            const match = pattern.exec(line);
            if (match) {
                matches.push({
                    uri,
                    filename,
                    lineNumber: i + 1,
                    lineText: line.slice(0, 200), // Truncate long lines
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                });
            }
        }
    }
    catch {
        // File read error — skip silently
    }
    return matches;
}
/** Max files to read simultaneously — prevents memory spikes with many log files. */
const searchBatchSize = 5;
/** Search all log files in batches, returning per-file match counts. */
async function searchLogFilesConcurrent(query, options = {}) {
    const empty = { query, files: [], totalFiles: 0, totalMatches: 0 };
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return empty;
    }
    const logDir = (0, config_1.getLogDirectoryUri)(folder);
    const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
    const tracked = await (0, config_1.readTrackedFiles)(logDir, fileTypes, includeSubfolders);
    const logFiles = tracked
        .map(rel => vscode.Uri.joinPath(logDir, rel))
        .sort((a, b) => b.fsPath.localeCompare(a.fsPath));
    const pattern = buildPattern(query, options);
    if (!pattern) {
        return empty;
    }
    const files = [];
    for (let i = 0; i < logFiles.length; i += searchBatchSize) {
        const batch = logFiles.slice(i, i + searchBatchSize);
        const batchResults = await Promise.all(batch.map(uri => countFileMatches(uri, pattern)));
        for (const r of batchResults) {
            if (r) {
                files.push(r);
            }
        }
    }
    const totalMatches = files.reduce((sum, f) => sum + f.matchCount, 0);
    return { query, files, totalFiles: logFiles.length, totalMatches };
}
/** Count matches in a single file (no line text — lightweight). */
async function countFileMatches(uri, pattern) {
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const lines = Buffer.from(data).toString('utf-8').split('\n');
        let matchCount = 0;
        for (let i = 0; i < lines.length; i++) {
            pattern.lastIndex = 0;
            if (pattern.test(lines[i])) {
                matchCount++;
            }
        }
        if (matchCount === 0) {
            return undefined;
        }
        const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
        return { uri, uriString: uri.toString(), filename, matchCount };
    }
    catch {
        return undefined;
    }
}
/** Open a log file at a specific line. */
async function openLogAtLine(match) {
    const doc = await vscode.workspace.openTextDocument(match.uri);
    const pos = new vscode.Position(match.lineNumber - 1, match.matchStart);
    const range = new vscode.Range(pos, pos);
    await vscode.window.showTextDocument(doc, { selection: range });
}
//# sourceMappingURL=log-search.js.map