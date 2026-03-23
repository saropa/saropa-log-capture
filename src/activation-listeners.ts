/**
 * Activation Listeners
 *
 * Setup functions for event listeners: line/split listeners,
 * config change handlers, scope context updates.
 */

import * as vscode from 'vscode';
import { getConfig } from './modules/config/config';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import { extractSourceReference } from './modules/source/source-linker';
import { buildScopeContext } from './modules/storage/scope-context';

export interface ListenerDeps {
    context: vscode.ExtensionContext;
    sessionManager: SessionManagerImpl;
    broadcaster: ViewerBroadcaster;
    historyProvider: SessionHistoryProvider;
    inlineDecorations: InlineDecorationsProvider;
}

/**
 * Setup line and split listeners for DAP output routing.
 */
export function setupLineListeners(deps: ListenerDeps): void {
    const { sessionManager, broadcaster, historyProvider, inlineDecorations } = deps;

    sessionManager.addLineListener((data) => {
        broadcaster.addLine(data);
        historyProvider.setActiveLineCount(data.lineCount);
        if (data.watchHits && data.watchHits.length > 0) {
            broadcaster.updateWatchCounts(sessionManager.getWatcher().getCounts());
        }
        if (!data.isMarker) {
            const sourceRef = extractSourceReference(data.text);
            if (sourceRef) {
                inlineDecorations.recordLogLine(
                    sourceRef.filePath,
                    sourceRef.line,
                    data.text,
                    data.category,
                );
            }
        }
    });

    sessionManager.addSplitListener((_newUri, partNumber, totalParts) => {
        broadcaster.setSplitInfo(partNumber, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            broadcaster.setFilename(filename);
        }
        historyProvider.refresh();
    });
}

/**
 * Setup configuration change listener.
 */
export function setupConfigListener(
    context: vscode.ExtensionContext,
    sessionManager: SessionManagerImpl,
    broadcaster: ViewerBroadcaster,
): void {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('saropaLogCapture')) { return; }
        const cfg = getConfig();
        sessionManager.refreshConfig(cfg);
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(cfg.iconBarPosition);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowInfoMarkers')) {
            broadcaster.setMinimapShowInfo(cfg.minimapShowInfoMarkers);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowSqlDensity')) {
            broadcaster.setMinimapShowSqlDensity(cfg.minimapShowSqlDensity);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapWidth')) {
            broadcaster.setMinimapWidth(cfg.minimapWidth);
        }
        if (e.affectsConfiguration('saropaLogCapture.showScrollbar')) {
            broadcaster.setScrollbarVisible(cfg.showScrollbar);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerAlwaysShowSearchMatchOptions')) {
            broadcaster.setSearchMatchOptionsAlwaysVisible(cfg.viewerAlwaysShowSearchMatchOptions);
        }
        if (e.affectsConfiguration('saropaLogCapture.autoHidePatterns')) {
            broadcaster.setAutoHidePatterns(cfg.autoHidePatterns);
        }
        if (
            e.affectsConfiguration('saropaLogCapture.repeatCollapseGlobalMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseReadMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseTransactionMinCount')
            || e.affectsConfiguration('saropaLogCapture.repeatCollapseDmlMinCount')
        ) {
            broadcaster.setViewerRepeatThresholds(cfg.viewerRepeatThresholds);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerDbInsightsEnabled')) {
            broadcaster.setViewerDbInsightsEnabled(cfg.viewerDbInsightsEnabled);
        }
        if (
            e.affectsConfiguration('saropaLogCapture.viewerSlowBurstSlowQueryMs')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstMinCount')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstWindowMs')
            || e.affectsConfiguration('saropaLogCapture.viewerSlowBurstCooldownMs')
        ) {
            broadcaster.setViewerSlowBurstThresholds(cfg.viewerSlowBurstThresholds);
        }
        if (
            e.affectsConfiguration('saropaLogCapture.viewerSqlPatternChipMinCount')
            || e.affectsConfiguration('saropaLogCapture.viewerSqlPatternMaxChips')
        ) {
            broadcaster.setViewerSqlPatternChipSettings(cfg.viewerSqlPatternChipMinCount, cfg.viewerSqlPatternMaxChips);
        }
    }));
}

/**
 * Setup scope context listener for source-scope filter.
 */
export function setupScopeContextListener(
    context: vscode.ExtensionContext,
    broadcaster: ViewerBroadcaster,
): void {
    const updateScopeContext = async (): Promise<void> => {
        const ctx = await buildScopeContext(vscode.window.activeTextEditor);
        broadcaster.setScopeContext(ctx);
    };
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => { updateScopeContext().catch(() => {}); }),
    );
    updateScopeContext().catch(() => {});
}
