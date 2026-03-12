/**
 * Investigation cross-source search.
 * Searches across all pinned sources in an investigation, including session sidecars.
 * Supports cancellation, progress reporting, and large file handling.
 */

import * as vscode from 'vscode';
import {
    Investigation,
    InvestigationSource,
    SearchOptions,
    SearchMatch,
    SourceSearchResult,
    InvestigationSearchResult,
    SEARCHABLE_SIDECAR_EXTENSIONS,
    SKIP_SIDECAR_EXTENSIONS,
    MAX_SEARCH_FILE_SIZE,
    MAX_RESULTS_PER_SOURCE,
} from './investigation-types';

/**
 * Resolve all searchable files for an investigation source.
 * For 'session' type, includes the main log and all searchable sidecars.
 * For 'file' type, returns just the file itself.
 */
async function resolveSearchableFiles(
    source: InvestigationSource,
    workspaceUri: vscode.Uri,
): Promise<{ uri: vscode.Uri; isSidecar: boolean }[]> {
    const mainUri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    const results: { uri: vscode.Uri; isSidecar: boolean }[] = [{ uri: mainUri, isSidecar: false }];

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
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return results;
    }

    for (const [name, type] of entries) {
        if (type !== vscode.FileType.File) { continue; }
        if (!name.startsWith(base + '.')) { continue; }

        const isSearchable = SEARCHABLE_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));
        const isSkipped = SKIP_SIDECAR_EXTENSIONS.some(ext => name.endsWith(ext));

        if (isSearchable && !isSkipped) {
            results.push({ uri: vscode.Uri.joinPath(dir, name), isSidecar: true });
        }
    }

    return results;
}

/** Escape special regex characters in a string. */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSearchRegex(query: string, options: SearchOptions): RegExp {
    const pattern = options.useRegex ? query : escapeRegex(query);
    const flags = options.caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
}

interface FileSearchParams {
    uri: vscode.Uri;
    regex: RegExp;
    contextLines: number;
    maxResults: number;
    token?: vscode.CancellationToken;
}

/** Search a single file for matches. */
async function searchFile(
    params: FileSearchParams,
): Promise<{ matches: SearchMatch[]; truncated: boolean; largeFileWarning: boolean }> {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat: vscode.FileStat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    } catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }

    const largeFileWarning = stat.size > MAX_SEARCH_FILE_SIZE;
    const searchSize = largeFileWarning ? MAX_SEARCH_FILE_SIZE : stat.size;

    let content: string;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const buffer = Buffer.from(data);
        content = buffer.toString('utf-8', 0, Math.min(buffer.length, searchSize));
    } catch {
        return { matches: [], truncated: false, largeFileWarning };
    }

    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }

    const lines = content.split('\n');
    const matches: SearchMatch[] = [];
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

            const contextBefore: string[] = [];
            const contextAfter: string[] = [];

            if (contextLines > 0) {
                for (let j = Math.max(0, i - contextLines); j < i; j++) {
                    contextBefore.push(lines[j].slice(0, 200));
                }
                for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); j++) {
                    contextAfter.push(lines[j].slice(0, 200));
                }
            }

            matches.push({
                line: i + 1,
                column: match.index + 1,
                text: line.slice(0, 300),
                contextBefore: contextBefore.length > 0 ? contextBefore : undefined,
                contextAfter: contextAfter.length > 0 ? contextAfter : undefined,
            });
        }
    }

    return { matches, truncated, largeFileWarning };
}

/** Search JSON sidecar files for matches in string values. */
async function searchJsonSidecar(
    params: FileSearchParams,
): Promise<{ matches: SearchMatch[]; truncated: boolean; largeFileWarning: boolean }> {
    const { uri, regex, contextLines, maxResults, token } = params;
    let stat: vscode.FileStat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    } catch {
        return { matches: [], truncated: false, largeFileWarning: false };
    }

    const largeFileWarning = stat.size > MAX_SEARCH_FILE_SIZE;

    let content: string;
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        content = Buffer.from(data).toString('utf-8');
    } catch {
        return { matches: [], truncated: false, largeFileWarning };
    }

    if (token?.isCancellationRequested) {
        return { matches: [], truncated: false, largeFileWarning };
    }

    const lines = content.split('\n');
    const matches: SearchMatch[] = [];
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

            const contextBefore: string[] = [];
            const contextAfter: string[] = [];

            if (contextLines > 0) {
                for (let j = Math.max(0, i - contextLines); j < i; j++) {
                    contextBefore.push(lines[j].slice(0, 200));
                }
                for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); j++) {
                    contextAfter.push(lines[j].slice(0, 200));
                }
            }

            matches.push({
                line: i + 1,
                column: 1,
                text: line.slice(0, 300),
                contextBefore: contextBefore.length > 0 ? contextBefore : undefined,
                contextAfter: contextAfter.length > 0 ? contextAfter : undefined,
            });
        }
    }

    return { matches, truncated, largeFileWarning };
}

/**
 * Search across all sources in an investigation.
 */
export async function searchInvestigation(
    investigation: Investigation,
    options: SearchOptions,
    token?: vscode.CancellationToken,
    progress?: (current: number, total: number, currentFile: string) => void,
): Promise<InvestigationSearchResult> {
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

    let regex: RegExp;
    try {
        regex = createSearchRegex(options.query, options);
    } catch {
        return {
            results: [],
            totalMatches: 0,
            totalSources: 0,
            cancelled: false,
            searchTimeMs: Date.now() - startTime,
        };
    }

    const contextLines = options.contextLines ?? 2;
    const maxResults = options.maxResultsPerSource ?? MAX_RESULTS_PER_SOURCE;

    const allFiles: { source: InvestigationSource; uri: vscode.Uri; isSidecar: boolean }[] = [];
    for (const source of investigation.sources) {
        const files = await resolveSearchableFiles(source, folder.uri);
        for (const file of files) {
            allFiles.push({ source, ...file });
        }
    }

    const results: SourceSearchResult[] = [];
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
        const fileParams: FileSearchParams = { uri, regex, contextLines, maxResults, token };
        const searchResult = isJson
            ? await searchJsonSidecar(fileParams)
            : await searchFile(fileParams);

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
export async function checkSourceExists(
    source: InvestigationSource,
    workspaceUri: vscode.Uri,
): Promise<boolean> {
    const uri = vscode.Uri.joinPath(workspaceUri, source.relativePath);
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}
