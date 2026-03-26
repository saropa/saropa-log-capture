"use strict";
/**
 * UI interactions for cross-session log search.
 * Provides the Quick Pick search interface.
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
exports.showSearchQuickPick = showSearchQuickPick;
const vscode = __importStar(require("vscode"));
const log_search_1 = require("./log-search");
/**
 * Show a Quick Pick UI for cross-session log search.
 * Returns the selected match or undefined if cancelled.
 *
 * @param initialQuery - Optional initial search query to pre-fill
 */
async function showSearchQuickPick(initialQuery) {
    const quickPick = vscode.window.createQuickPick();
    quickPick.title = 'Search Log Files';
    quickPick.placeholder = 'Type to search across all log files...';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    if (initialQuery) {
        quickPick.value = initialQuery;
    }
    let searchTimeout;
    const updateItems = (results) => {
        if (results.matches.length === 0) {
            quickPick.items = [{
                    label: '$(search) No matches found',
                    description: `Searched ${results.totalFiles} files`,
                    isHeader: true,
                }];
            return;
        }
        const items = [];
        // Group matches by file
        const byFile = new Map();
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
            const results = await (0, log_search_1.searchLogFiles)(value);
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
        (0, log_search_1.searchLogFiles)(initialQuery).then((results) => {
            updateItems(results);
            quickPick.busy = false;
        });
    }
    else {
        quickPick.items = [{
                label: '$(info) Type at least 2 characters to search',
                isHeader: true,
            }];
    }
    return new Promise((resolve) => {
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
function highlightMatch(match) {
    const line = match.lineText;
    // Just return the line — VS Code QuickPick doesn't support rich text
    // but showing context is still helpful
    return line.trim();
}
//# sourceMappingURL=log-search-ui.js.map