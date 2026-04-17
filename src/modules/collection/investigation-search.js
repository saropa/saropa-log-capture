"use strict";
/**
 * Investigation cross-source search.
 * Searches across all pinned sources in an investigation, including session sidecars.
 * Supports cancellation, progress reporting, and large file handling.
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
exports.escapeRegex = escapeRegex;
exports.searchInvestigation = searchInvestigation;
exports.checkSourceExists = checkSourceExists;
const vscode = __importStar(require("vscode"));
const investigation_types_1 = require("./investigation-types");
const investigation_search_file_1 = require("./investigation-search-file");
/** Escape special regex characters in a string. */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function createSearchRegex(query, options) {
    const pattern = options.useRegex ? query : escapeRegex(query);
    const flags = options.caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
}
/**
 * Search across all sources in an investigation.
 */
async function searchInvestigation(investigation, options, token, progress) {
    const startTime = Date.now();
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !options.query.trim()) {
        return {
            results: [],
            totalMatches: 0,
            totalSources: 0,
            cancelled: false,
            searchTimeMs: 0,
        };
    }
    let regex;
    try {
        regex = createSearchRegex(options.query, options);
    }
    catch {
        return {
            results: [],
            totalMatches: 0,
            totalSources: 0,
            cancelled: false,
            searchTimeMs: Date.now() - startTime,
        };
    }
    const contextLines = options.contextLines ?? 2;
    const maxResults = options.maxResultsPerSource ?? investigation_types_1.MAX_RESULTS_PER_SOURCE;
    const allFiles = [];
    for (const source of investigation.sources) {
        const files = await (0, investigation_search_file_1.resolveSearchableFiles)(source, folder.uri);
        for (const file of files) {
            allFiles.push({ source, ...file });
        }
    }
    const results = [];
    let totalMatches = 0;
    let cancelled = false;
    for (let i = 0; i < allFiles.length; i++) {
        if (token?.isCancellationRequested) {
            cancelled = true;
            break;
        }
        const { source, uri } = allFiles[i];
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        progress?.(i + 1, allFiles.length, relativePath);
        const isJson = uri.fsPath.endsWith('.json');
        const fileParams = { uri, regex, contextLines, maxResults, token };
        const searchResult = isJson
            ? await (0, investigation_search_file_1.searchJsonSidecar)(fileParams)
            : await (0, investigation_search_file_1.searchFile)(fileParams);
        if (searchResult.matches.length > 0) {
            results.push({
                source,
                sourceFile: relativePath,
                matches: searchResult.matches,
                truncated: searchResult.truncated,
                largeFileWarning: searchResult.largeFileWarning,
            });
            totalMatches += searchResult.matches.length;
        }
    }
    return {
        results,
        totalMatches,
        totalSources: results.length,
        cancelled,
        searchTimeMs: Date.now() - startTime,
    };
}
/**
 * Check if a source file exists and is readable.
 */
async function checkSourceExists(source, workspaceUri) {
    const uri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=investigation-search.js.map