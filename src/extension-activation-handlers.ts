/**
 * Viewer-specific handler wiring for the main LogViewerProvider.
 *
 * These handlers are NOT shared with PopOutPanel (that uses wireSharedHandlers).
 * They cover session navigation, file-loaded side effects, pop-out, signal tab,
 * reveal, and find-in-files.
 */
import * as vscode from 'vscode';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { BookmarkStore } from './modules/storage/bookmark-store';
import type { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';
import { updateLastViewed } from './ui/provider/viewer-provider-helpers';
import { searchLogFilesConcurrent } from './modules/search/log-search';
import { maybeSuggestSmartBookmark } from './extension-activation-helpers';

interface ViewerHandlerDeps {
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly bookmarkStore: BookmarkStore;
    readonly popOutPanel: PopOutPanel;
    readonly context: vscode.ExtensionContext;
    readonly version: string;
}

/**
 * Wire all viewer-specific handlers on the LogViewerProvider.
 * @returns updateSessionNav — needed by registerDebugLifecycle.
 */
export function wireViewerSpecificHandlers(deps: ViewerHandlerDeps): { updateSessionNav: () => Promise<void> } {
    const { viewerProvider, historyProvider, bookmarkStore, popOutPanel, context, version } = deps;

    const updateSessionNav = async (): Promise<void> => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { viewerProvider.setSessionNavInfo(false, false, 0, 0); return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        viewerProvider.setSessionNavInfo(!!adj.prev, !!adj.next, adj.index, adj.total);
    };

    const smartBookmarkSuggestedForUri = new Set<string>();
    viewerProvider.setFileLoadedHandler((uri, loadResult) => {
        void updateSessionNav();
        const isActive = historyProvider.getActiveUri()?.toString() === uri.toString();
        if (isActive) {
            void maybeSuggestSmartBookmark(uri, loadResult, bookmarkStore, smartBookmarkSuggestedForUri);
        }
    });

    viewerProvider.setSessionNavigateHandler(async (direction) => {
        const uri = viewerProvider.getCurrentFileUri();
        if (!uri) { return; }
        const adj = await historyProvider.getAdjacentSessions(uri);
        const target = direction < 0 ? adj.prev : adj.next;
        if (target) { await viewerProvider.loadFromFile(target); }
    });

    viewerProvider.setBecameVisibleHandler(() => {
        // Active session always takes priority.
        const activeUri = historyProvider.getActiveUri();
        if (activeUri) {
            if (viewerProvider.getCurrentFileUri()?.toString() === activeUri.toString()) { return; }
            void viewerProvider.loadFromFile(activeUri);
            return;
        }
    });

    viewerProvider.setOpenSessionFromPanelHandler(async (uriString) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
        await updateLastViewed(context, uriString);
    });

    viewerProvider.setPopOutHandler(() => { void popOutPanel.open(); });

    viewerProvider.setOpenSignalTabHandler(() => {
        openSignalTab({
            getCurrentFileUri: () => viewerProvider.getCurrentFileUri(),
            context,
            extensionUri: context.extensionUri,
            version,
        });
    });

    viewerProvider.setRevealLogFileHandler(async () => {
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
    });

    viewerProvider.setFindInFilesHandler(async (query, options) => {
        const results = await searchLogFilesConcurrent(query, {
            caseSensitive: Boolean(options.caseSensitive),
            useRegex: Boolean(options.useRegex),
            wholeWord: Boolean(options.wholeWord),
        });
        viewerProvider.sendFindResults(results);
    });

    viewerProvider.setOpenFindResultHandler(async (uriString, query, options) => {
        if (!uriString) { return; }
        await viewerProvider.loadFromFile(vscode.Uri.parse(uriString));
        viewerProvider.setupFindSearch(query, options);
    });

    viewerProvider.setFindNavigateMatchHandler(() => { viewerProvider.findNextMatch(); });

    return { updateSessionNav };
}
