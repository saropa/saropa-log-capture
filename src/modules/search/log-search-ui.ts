/**
 * UI interactions for cross-session log search.
 * Provides the Quick Pick search interface.
 */

import * as vscode from 'vscode';
import { SearchMatch, SearchResults, searchLogFiles } from './log-search';

/** Quick pick item for search results. */
interface SearchQuickPickItem extends vscode.QuickPickItem {
    readonly match?: SearchMatch;
    readonly isHeader?: boolean;
}

/**
 * Show a Quick Pick UI for cross-session log search.
 * Returns the selected match or undefined if cancelled.
 *
 * @param initialQuery - Optional initial search query to pre-fill
 */
export async function showSearchQuickPick(initialQuery?: string): Promise<SearchMatch | undefined> {
    const quickPick = vscode.window.createQuickPick<SearchQuickPickItem>();
    quickPick.title = 'Search Log Files';
    quickPick.placeholder = 'Type to search across all log files...';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    if (initialQuery) {
        quickPick.value = initialQuery;
    }

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

    // Show initial prompt or trigger search if initialQuery provided
    if (initialQuery && initialQuery.length >= 2) {
        quickPick.busy = true;
        quickPick.items = [{
            label: '$(sync~spin) Searching...',
            isHeader: true,
        }];
        searchLogFiles(initialQuery).then((results) => {
            updateItems(results);
            quickPick.busy = false;
        });
    } else {
        quickPick.items = [{
            label: '$(info) Type at least 2 characters to search',
            isHeader: true,
        }];
    }

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
