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
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import { openSignalTab } from './ui/viewer-panels/signal-tab-panel';
import { updateLastViewed, getOrSeedDismissedAt } from './ui/provider/viewer-provider-helpers';
import { computeLogContextInfo } from './ui/provider/viewer-log-context';
import { searchLogFilesConcurrent } from './modules/search/log-search';
import { maybeSuggestSmartBookmark, type SmartBookmarkSession } from './extension-activation-helpers';
import { refreshCumulativeSqlFingerprintBaseline } from './modules/db/cumulative-sql-fingerprint-refresh';
import { recordLoadedFile } from './modules/session/loaded-files-history';
import { computeLoadedFileMetadata } from './modules/session/loaded-file-metadata';
import { getConfig, getActiveLogDirectoryUri } from './modules/config/config';
import { logExtensionError } from './modules/misc/extension-logger';
import { t } from './l10n';

interface ViewerHandlerDeps {
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly bookmarkStore: BookmarkStore;
    readonly popOutPanel: PopOutPanel;
    readonly broadcaster: ViewerBroadcaster;
    readonly outputChannel: vscode.OutputChannel;
    readonly context: vscode.ExtensionContext;
    readonly version: string;
}

/**
 * Record a file opened from OUTSIDE the configured reports directory into the loaded-files
 * history, so it shows in the Logs list grouped by the day it was loaded. Files INSIDE the
 * reports folder are skipped — the directory scan already lists them; recording them would
 * bloat the history and they'd be deduped out of the injected rows anyway.
 *
 * Fire-and-forget: a recording failure must never disrupt the load the user asked for.
 */
async function recordExternalLoad(
    deps: { historyProvider: SessionHistoryProvider; broadcaster: ViewerBroadcaster; context: vscode.ExtensionContext },
    uri: vscode.Uri,
): Promise<void> {
    try {
        // Only real on-disk files have a stable path to record + re-read later.
        if (uri.scheme !== 'file') { return; }
        // Resolve the SAME directory the Logs panel reads (override root, else workspace default).
        // Keying off this — not workspaceFolders[0] — is what makes recording work when the panel
        // is pointed at a browsed override root with no workspace folder open.
        const logDir = getActiveLogDirectoryUri(deps.context);
        if (!logDir) { return; }
        // In-folder files are already scanned into the list; case-insensitive prefix match
        // because Windows paths are case-insensitive and the URI casing can differ.
        if (uri.fsPath.toLowerCase().startsWith(logDir.fsPath.toLowerCase())) { return; }
        const strict = getConfig().levelDetection === 'strict';
        const meta = await computeLoadedFileMetadata(uri, strict);
        if (!meta) { return; }
        await recordLoadedFile(logDir, { ...meta, loadedAt: Date.now() });
        // Visible outcome for a file action (no silent async): names the file just tracked so
        // the user sees it landed in the Logs history, and so this path is observable at runtime.
        void vscode.window.showInformationMessage(t('msg.loadedFileTracked', meta.filename));
        // Tree refreshes via cache invalidation; the webview Logs panel needs an explicit
        // re-request nudge (it has no host-push channel for the session list otherwise).
        deps.historyProvider.refresh();
        deps.broadcaster.postToWebview({ type: 'refreshSessionList' });
    } catch (err) {
        logExtensionError('recordExternalLoad', err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Wire all viewer-specific handlers on the LogViewerProvider.
 * @returns refreshLogContext — recomputes the open log's staleness/lifespan banner context;
 *   needed by registerDebugLifecycle so a debug-session start/stop refreshes it.
 */
export function wireViewerSpecificHandlers(deps: ViewerHandlerDeps): { refreshLogContext: () => Promise<void> } {
    const { viewerProvider, historyProvider, bookmarkStore, popOutPanel, broadcaster, outputChannel, context, version } = deps;

    /* Recompute the staleness/lifespan context for the open log and broadcast it to every viewer
       surface (sidebar + pop-out). Replaces the old "Log N of M" navigator: instead of position,
       the toolbar shows how far behind the latest main-project (controller) log the open one is,
       and the banner auto-surfaces when a newer controller log exists. Fired on every file load. */
    const refreshLogContext = async (): Promise<void> => {
        const cfg = getConfig();
        const info = computeLogContextInfo({
            items: await historyProvider.getAllChildren(),
            currentUri: viewerProvider.getCurrentFileUri()?.toString(),
            controllerNames: cfg.reportsClassifier.controllerNames,
            workspaceFolderName: vscode.workspace.workspaceFolders?.[0]?.name,
            dismissedAt: getOrSeedDismissedAt(context),
        });
        broadcaster.setLogContextInfo(info);
    };

    const smartBookmarkSession: SmartBookmarkSession = {
        promptedUris: new Set<string>(),
        ignoredErrorTexts: new Set<string>(),
    };
    const smartBookmarkViewer = {
        scrollToLine: (line: number) => viewerProvider.scrollToLine(line),
    };
    viewerProvider.setFileLoadedHandler((uri, loadResult) => {
        void refreshLogContext();
        const isActive = historyProvider.getActiveUri()?.toString() === uri.toString();
        if (isActive) {
            void maybeSuggestSmartBookmark(uri, loadResult, bookmarkStore, smartBookmarkSession, smartBookmarkViewer);
        }
        /* Record EVERY load here — this is the single chokepoint all open paths flow through
           (kebab "Open log file", drag-and-drop, URI handlers, session-nav), so no entry point
           can be missed the way per-command hooks were. recordExternalLoad self-filters to files
           outside the reports folder; in-folder sessions are already in the directory scan. */
        if (!isActive) { void recordExternalLoad({ historyProvider, broadcaster, context }, uri); }
        /* DB_17: refresh cumulative SQL fingerprint baseline whenever the active log changes,
           so the SQL History panel's `Cumulative` toggle reflects every OTHER sidebar log
           except the one now in view (active log feeds `sqlQueryHistoryByFp` live). */
        void refreshCumulativeSqlFingerprintBaseline(broadcaster, uri, outputChannel);
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

    return { refreshLogContext };
}
