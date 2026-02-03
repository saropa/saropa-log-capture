/**
 * Cross-session log search functionality.
 * Searches across all log files in the reports directory.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, isTrackedFile } from './config';

/** A single search match within a log file. */
export interface SearchMatch {
    readonly uri: vscode.Uri;
    readonly filename: string;
    readonly lineNumber: number;
    readonly lineText: string;
    readonly matchStart: number;
    readonly matchEnd: number;
}

/** Search results grouped by session file. */
export interface SearchResults {
    readonly query: string;
    readonly matches: readonly SearchMatch[];
    readonly totalFiles: number;
    readonly filesWithMatches: number;
}

/** Options for the search operation. */
export interface SearchOptions {
    readonly caseSensitive?: boolean;
    readonly useRegex?: boolean;
    readonly wholeWord?: boolean;
    readonly maxResults?: number;
    readonly maxResultsPerFile?: number;
}

/** Per-file result for Find in Files (counts only, no line text). */
export interface FileSearchResult {
    readonly uri: vscode.Uri;
    readonly uriString: string;
    readonly filename: string;
    readonly matchCount: number;
}

/** Aggregated results for Find in Files. */
export interface FindInFilesResults {
    readonly query: string;
    readonly files: readonly FileSearchResult[];
    readonly totalFiles: number;
    readonly totalMatches: number;
}

const DEFAULT_MAX_RESULTS = 500;
const DEFAULT_MAX_PER_FILE = 50;

/**
 * Search across all log files in the workspace.
 * Returns matches grouped by file with line numbers.
 */
export async function searchLogFiles(
    query: string,
    options: SearchOptions = {},
): Promise<SearchResults> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return { query, matches: [], totalFiles: 0, filesWithMatches: 0 };
    }

    const logDir = getLogDirectoryUri(folder);
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    const maxPerFile = options.maxResultsPerFile ?? DEFAULT_MAX_PER_FILE;
    const matches: SearchMatch[] = [];
    let totalFiles = 0;
    let filesWithMatches = 0;

    // List all tracked files
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDir);
    } catch {
        return { query, matches: [], totalFiles: 0, filesWithMatches: 0 };
    }

    const { fileTypes } = getConfig();
    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && isTrackedFile(name, fileTypes))
        .map(([name]) => vscode.Uri.joinPath(logDir, name))
        .sort((a, b) => b.fsPath.localeCompare(a.fsPath)); // Newest first

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
function buildPattern(query: string, options: SearchOptions): RegExp | undefined {
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
    } catch {
        return undefined;
    }
}

/** Search a single file and return matches. */
async function searchFile(
    uri: vscode.Uri,
    pattern: RegExp,
    maxMatches: number,
): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
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
    } catch {
        // File read error — skip silently
    }

    return matches;
}

/** Search all log files concurrently, returning per-file match counts. */
export async function searchLogFilesConcurrent(
    query: string,
    options: SearchOptions = {},
): Promise<FindInFilesResults> {
    const empty: FindInFilesResults = { query, files: [], totalFiles: 0, totalMatches: 0 };
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return empty; }

    const logDir = getLogDirectoryUri(folder);
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDir);
    } catch {
        return empty;
    }

    const { fileTypes } = getConfig();
    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && isTrackedFile(name, fileTypes))
        .map(([name]) => vscode.Uri.joinPath(logDir, name))
        .sort((a, b) => b.fsPath.localeCompare(a.fsPath));

    const pattern = buildPattern(query, options);
    if (!pattern) { return empty; }

    const results = await Promise.all(logFiles.map(uri => countFileMatches(uri, pattern)));
    const files = results.filter((r): r is FileSearchResult => r !== undefined);
    const totalMatches = files.reduce((sum, f) => sum + f.matchCount, 0);
    return { query, files, totalFiles: logFiles.length, totalMatches };
}

/** Count matches in a single file (no line text — lightweight). */
async function countFileMatches(uri: vscode.Uri, pattern: RegExp): Promise<FileSearchResult | undefined> {
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const lines = Buffer.from(data).toString('utf-8').split('\n');
        let matchCount = 0;
        for (let i = 0; i < lines.length; i++) {
            pattern.lastIndex = 0;
            if (pattern.test(lines[i])) { matchCount++; }
        }
        if (matchCount === 0) { return undefined; }
        const filename = uri.fsPath.split(/[\\/]/).pop() ?? '';
        return { uri, uriString: uri.toString(), filename, matchCount };
    } catch {
        return undefined;
    }
}

/** Open a log file at a specific line. */
export async function openLogAtLine(match: SearchMatch): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(match.uri);
    const pos = new vscode.Position(match.lineNumber - 1, match.matchStart);
    const range = new vscode.Range(pos, pos);
    await vscode.window.showTextDocument(doc, { selection: range });
}
