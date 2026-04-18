/**
 * Collection cross-source search.
 * Searches across all pinned sources in a collection, including session sidecars.
 * Supports cancellation, progress reporting, and large file handling.
 */

import * as vscode from 'vscode';
import {
    Collection,
    CollectionSource,
    SearchOptions,
    SourceSearchResult,
    CollectionSearchResult,
    MAX_RESULTS_PER_SOURCE,
} from './collection-types';
import {
    resolveSearchableFiles,
    searchFile,
    searchJsonSidecar,
    type FileSearchParams,
} from './collection-search-file';

/** Escape special regex characters in a string. */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSearchRegex(query: string, options: SearchOptions): RegExp {
    const pattern = options.useRegex ? query : escapeRegex(query);
    const flags = options.caseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
}

/**
 * Search across all sources in a collection.
 */
export async function searchCollection(
    collection: Collection,
    options: SearchOptions,
    token?: vscode.CancellationToken,
    progress?: (current: number, total: number, currentFile: string) => void,
): Promise<CollectionSearchResult> {
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

    const allFiles: { source: CollectionSource; uri: vscode.Uri; isSidecar: boolean }[] = [];
    for (const source of collection.sources) {
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
    source: CollectionSource,
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
