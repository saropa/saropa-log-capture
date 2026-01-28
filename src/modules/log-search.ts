/**
 * Cross-session log search functionality.
 * Searches across all log files in the reports directory.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './config';

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
    readonly maxResults?: number;
    readonly maxResultsPerFile?: number;
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

    // List all .log files
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDir);
    } catch {
        return { query, matches: [], totalFiles: 0, filesWithMatches: 0 };
    }

    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'))
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
        // Escape special regex characters for literal search
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, flags);
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

/** Quick pick item for search results. */
interface SearchQuickPickItem extends vscode.QuickPickItem {
    readonly match?: SearchMatch;
    readonly isHeader?: boolean;
}

/**
 * Show a Quick Pick UI for cross-session log search.
 * Returns the selected match or undefined if cancelled.
 */
export async function showSearchQuickPick(): Promise<SearchMatch | undefined> {
    const quickPick = vscode.window.createQuickPick<SearchQuickPickItem>();
    quickPick.title = 'Search Log Files';
    quickPick.placeholder = 'Type to search across all log files...';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    let searchTimeout: NodeJS.Timeout | undefined;

    const updateItems = (results: SearchResults): void => {
        if (results.matches.length === 0) {
            quickPick.items = [{
                label: '$(search) No matches found',
                description: `Searched ${results.totalFiles} files`,
                isHeader: true,
            }];
            return;
        }

        const items: SearchQuickPickItem[] = [];

        // Group matches by file
        const byFile = new Map<string, SearchMatch[]>();
        for (const match of results.matches) {
            const existing = byFile.get(match.filename) ?? [];
            existing.push(match);
            byFile.set(match.filename, existing);
        }

        // Add file headers and matches
        for (const [filename, fileMatches] of byFile) {
            items.push({
                label: `$(file) ${filename}`,
                description: `${fileMatches.length} match${fileMatches.length > 1 ? 'es' : ''}`,
                kind: vscode.QuickPickItemKind.Separator,
                isHeader: true,
            });

            for (const match of fileMatches) {
                items.push({
                    label: `  $(location) Line ${match.lineNumber}`,
                    description: highlightMatch(match),
                    match,
                });
            }
        }

        // Add summary
        items.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator,
            isHeader: true,
        });
        items.push({
            label: `$(info) ${results.matches.length} matches in ${results.filesWithMatches} of ${results.totalFiles} files`,
            isHeader: true,
        });

        quickPick.items = items;
    };

    quickPick.onDidChangeValue(async (value) => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (value.length < 2) {
            quickPick.items = [{
                label: '$(info) Type at least 2 characters to search',
                isHeader: true,
            }];
            return;
        }

        quickPick.busy = true;
        quickPick.items = [{
            label: '$(sync~spin) Searching...',
            isHeader: true,
        }];

        // Debounce search
        searchTimeout = setTimeout(async () => {
            const results = await searchLogFiles(value);
            updateItems(results);
            quickPick.busy = false;
        }, 200);
    });

    quickPick.items = [{
        label: '$(info) Type at least 2 characters to search',
        isHeader: true,
    }];

    return new Promise<SearchMatch | undefined>((resolve) => {
        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            quickPick.hide();
            resolve(selected?.match);
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            resolve(undefined);
        });

        quickPick.show();
    });
}

/** Create a highlighted preview of the match. */
function highlightMatch(match: SearchMatch): string {
    const line = match.lineText;
    // Just return the line — VS Code QuickPick doesn't support rich text
    // but showing context is still helpful
    return line.trim();
}

/**
 * Open a log file at a specific line.
 */
export async function openLogAtLine(match: SearchMatch): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(match.uri);
    const pos = new vscode.Position(match.lineNumber - 1, match.matchStart);
    const range = new vscode.Range(pos, pos);
    await vscode.window.showTextDocument(doc, { selection: range });
}
