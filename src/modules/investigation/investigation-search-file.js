"use strict";
/**
 * File-level search for investigation sources (single file and JSON sidecar).
 * Extracted to keep investigation-search.ts under the line limit.
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
exports.gatherContext = gatherContext;
exports.resolveSearchableFiles = resolveSearchableFiles;
exports.searchFile = searchFile;
exports.searchJsonSidecar = searchJsonSidecar;
const vscode = __importStar(require("vscode"));
const investigation_types_1 = require("./investigation-types");
/** Gather surrounding context lines around an index, truncated to 200 chars. */
function gatherContext(lines, index, contextLines) {
    const before = [];
    for (let j = Math.max(0, index - contextLines); j < index; j++) {
        before.push(lines[j].slice(0, 200));
    }
    const after = [];
    for (let j = index + 1; j <= Math.min(lines.length - 1, index + contextLines); j++) {
        after.push(lines[j].slice(0, 200));
    }
    return { before, after };
}
/**
 * Resolve all searchable files for an investigation source.
 * For 'session' type, includes the main log and all searchable sidecars.
 * For 'file' type, returns just the file itself.
 */
async function resolveSearchableFiles(source, workspaceUri) {
    const mainUri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    const results = [{ uri: mainUri, isSidecar: false }];
    if (source.type !== 'session') {
        return results;
    }
    const dir = vscode.Uri.joinPath(mainUri, '..');
    const mainName = source.relativePath.split(/[/\\]/).pop() ?? '';
    const baseMatch = mainName.match(/^(.+?)(_\d{3})?\.log$/i);
    if (!baseMatch) {
        return results;
    }
    const base = baseMatch[1];
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    }
    catch {
        return results;
    }
    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) {
            continue;
        }
        if (!name.startsWith(base + '.')) {
            continue;
        }
        const isSearchable = investigation_types_1.SEARCHABLE_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        const isSkipped = investigation_types_1.SKIP_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        if (isSearchable && !isSkipped) {
            results.push({ uri: vscode.Uri.joinPath(dir, name), isSidecar: true });
        }
    }
    return results;
}
/** Search a single file for matches. */
async function searchFile(params) {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    }
    catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }
    const largeFileWarning = stat.size > investigation_types_1.MAX_SEARCH_FILE_SIZE;
    const searchSize = largeFileWarning ? investigation_types_1.MAX_SEARCH_FILE_SIZE : stat.size;
    let content;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(data);
        content = buffer.toString('utf-8', 0, Math.min(buffer.length, searchSize));
    }
    catch {
        return { matches: [], truncated: false, largeFileWarning };
    }
    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }
    const lines = content.split('\n');
    const matches = [];
    let truncated = false;
    for (let i = 0; i < lines.length; i++) {
        if (token?.isCancellationRequested) {
            break;
        }
        const line = lines[i];
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (match) {
            if (matches.length >= maxResults) {
                truncated = true;
                break;
            }
            const ctx = contextLines > 0 ? gatherContext(lines, i, contextLines) : undefined;
            matches.push({
                line: i + 1,
                column: match.index + 1,
                text: line.slice(0, 300),
                contextBefore: ctx?.before.length ? ctx.before : undefined,
                contextAfter: ctx?.after.length ? ctx.after : undefined,
            });
        }
    }
    return { matches, truncated, largeFileWarning };
}
/** Search JSON sidecar files for matches in string values. */
async function searchJsonSidecar(params) {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    }
    catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }
    const largeFileWarning = stat.size > investigation_types_1.MAX_SEARCH_FILE_SIZE;
    let content;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(data).toString('utf-8');
    }
    catch {
        return { matches: [], truncated: false, largeFileWarning };
    }
    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }
    const lines = content.split('\n');
    const matches = [];
    let truncated = false;
    for (let i = 0; i < lines.length; i++) {
        if (token?.isCancellationRequested) {
            break;
        }
        const line = lines[i];
        regex.lastIndex = 0;
        if (regex.test(line)) {
            if (matches.length >= maxResults) {
                truncated = true;
                break;
            }
            const ctx = contextLines > 0 ? gatherContext(lines, i, contextLines) : undefined;
            matches.push({
                line: i + 1,
                column: 1,
                text: line.slice(0, 300),
                contextBefore: ctx?.before.length ? ctx.before : undefined,
                contextAfter: ctx?.after.length ? ctx.after : undefined,
            });
        }
    }
    return { matches, truncated, largeFileWarning };
}
//# sourceMappingURL=investigation-search-file.js.map