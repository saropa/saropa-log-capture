/**
 * Activation Listeners
 *
 * Setup functions for event listeners: line/split listeners,
 * config change handlers, scope context updates.
 */

import * as vscode from 'vscode';
import { getConfig, errorRateConfigFromConfig } from './modules/config/config';
import { setSeverityKeywords } from './modules/analysis/level-classifier';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import { DiagnosticCache } from './modules/diagnostics/diagnostic-cache';
import { extractSourceReference } from './modules/source/source-linker';
import { buildScopeContext, type ScopeContext } from './modules/storage/scope-context';
import { getLearningWebviewOptions } from './modules/learning/learning-webview-options';
import { mergeIntegrationAdaptersForWebview } from './modules/integrations/integration-adapter-constants';
import type { CaptureToggleStatusBar } from './ui/shared/capture-toggle-status-bar';

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
    captureToggle: CaptureToggleStatusBar,
): void {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('saropaLogCapture')) { return; }
        const cfg = getConfig();
        sessionManager.refreshConfig(cfg);
        if (e.affectsConfiguration('saropaLogCapture.enabled')) {
            /* Keep the status bar toggle in sync when the setting changes
             * externally (e.g. via the Settings UI or settings.json edit). */
            captureToggle.setEnabled(cfg.enabled);
        }
        if (e.affectsConfiguration('saropaLogCapture.iconBarPosition')) {
            broadcaster.setIconBarPosition(cfg.iconBarPosition);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowInfoMarkers')) {
            broadcaster.setMinimapShowInfo(cfg.minimapShowInfoMarkers);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapShowSqlDensity')) {
            broadcaster.setMinimapShowSqlDensity(cfg.minimapShowSqlDensity);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapProportionalLines')) {
            broadcaster.setMinimapProportionalLines(cfg.minimapProportionalLines);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapViewportRedOutline')) {
            broadcaster.setMinimapViewportRedOutline(cfg.minimapViewportRedOutline);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapViewportOutsideArrow')) {
            broadcaster.setMinimapViewportOutsideArrow(cfg.minimapViewportOutsideArrow);
        }
        if (e.affectsConfiguration('saropaLogCapture.minimapWidth')) {
            broadcaster.setMinimapWidth(cfg.minimapWidth);
            /* Explicit preset change clears any custom drag-to-resize width */
            context.workspaceState.update('saropaLogCapture.minimapCustomPx', undefined)
                .then(undefined, () => {});
        }
        if (e.affectsConfiguration('saropaLogCapture.showScrollbar')) {
            broadcaster.setScrollbarVisible(cfg.showScrollbar);
        }
        if (e.affectsConfiguration('saropaLogCapture.viewerAlwaysShowSearchMatchOptions')) {
            broadcaster.setSearchMatchOptionsAlwaysVisible(cfg.viewerAlwaysShowSearchMatchOptions);
        }
        if (e.affectsConfiguration('saropaLogCapture.learning')) {
            broadcaster.postToWebview(getLearningWebviewOptions());
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
        if (e.affectsConfiguration('saropaLogCapture.viewerDbSignalsEnabled')) {
            broadcaster.setViewerDbSignalsEnabled(cfg.viewerDbSignalsEnabled);
        }
        if (e.affectsConfiguration('saropaLogCapture.staticSqlFromFingerprint.enabled')) {
            broadcaster.setStaticSqlFromFingerprintEnabled(cfg.staticSqlFromFingerprintEnabled);
        }
        if (
            e.affectsConfiguration('saropaLogCapture.viewerDbDetectorNPlusOneEnabled')
            || e.affectsConfiguration('saropaLogCapture.viewerDbDetectorSlowBurstEnabled')
            || e.affectsConfiguration('saropaLogCapture.viewerDbDetectorBaselineHintsEnabled')
            || e.affectsConfiguration('saropaLogCapture.viewerDbDetectorTimestampBurstEnabled')
        ) {
            broadcaster.setViewerDbDetectorToggles({
                nPlusOneEnabled: cfg.viewerDbDetectorNPlusOneEnabled,
                slowBurstEnabled: cfg.viewerDbDetectorSlowBurstEnabled,
                baselineHintsEnabled: cfg.viewerDbDetectorBaselineHintsEnabled,
                timestampBurstEnabled: cfg.viewerDbDetectorTimestampBurstEnabled,
            });
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
            e.affectsConfiguration('saropaLogCapture.errorRateBucketSize')
            || e.affectsConfiguration('saropaLogCapture.errorRateShowWarnings')
            || e.affectsConfiguration('saropaLogCapture.errorRateDetectSpikes')
        ) {
            broadcaster.setErrorRateConfig(errorRateConfigFromConfig(cfg));
        }
        if (
            e.affectsConfiguration('saropaLogCapture.integrations.adapters')
            || e.affectsConfiguration('saropaLogCapture.ai.enabled')
        ) {
            syncIntegrationsAdaptersToWebview(broadcaster);
        }
        if (e.affectsConfiguration('saropaLogCapture.integrations.adapters')) {
            showSecurityAdapterNotice(context, cfg).catch(() => {});
        }
        if (
            e.affectsConfiguration('saropaLogCapture.suppressTransientErrors')
            || e.affectsConfiguration('saropaLogCapture.breakOnCritical')
            || e.affectsConfiguration('saropaLogCapture.levelDetection')
            || e.affectsConfiguration('saropaLogCapture.stderrTreatAsError')
            || e.affectsConfiguration('saropaLogCapture.severityKeywords')
        ) {
            setSeverityKeywords(cfg.severityKeywords);
            broadcaster.setErrorClassificationSettings({
                suppressTransientErrors: cfg.suppressTransientErrors,
                breakOnCritical: cfg.breakOnCritical,
                levelDetection: cfg.levelDetection,
                stderrTreatAsError: cfg.stderrTreatAsError,
                severityKeywords: cfg.severityKeywords,
            });
        }
    }));
}

const securityNoticeKey = 'securityAdapterNoticeShown';

/** Push session + Explain-with-AI checkbox state to the log viewer after settings change. */
function syncIntegrationsAdaptersToWebview(broadcaster: ViewerBroadcaster): void {
    const cfg = getConfig();
    const merged = mergeIntegrationAdaptersForWebview(
        cfg.integrationsAdapters,
        vscode.workspace.getConfiguration('saropaLogCapture.ai').get<boolean>('enabled', false),
    );
    broadcaster.postToWebview({ type: 'integrationsAdapters', adapterIds: merged });
}

/** Show a one-time info message when the security adapter is first enabled. */
async function showSecurityAdapterNotice(
    context: vscode.ExtensionContext,
    cfg: ReturnType<typeof getConfig>,
): Promise<void> {
    if (!cfg.integrationsAdapters.includes('security')) { return; }
    if (context.workspaceState.get<boolean>(securityNoticeKey)) { return; }
    await context.workspaceState.update(securityNoticeKey, true);
    const openSettings = 'Open Settings';
    const choice = await vscode.window.showInformationMessage(
        'Security adapter enabled. Events may contain sensitive data — redaction is on by default. Configure paths in Settings.',
        openSettings,
    );
    if (choice === openSettings) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.integrations.security').then(undefined, () => {});
    }
}

/** Narrow shape of the broadcaster that the scope listener actually uses. */
export interface ScopeContextBroadcaster {
    setScopeContext(ctx: ScopeContext): void;
}

/**
 * Build and broadcast scope context for the given editor, optionally skipping
 * the broadcast when the editor is `undefined`.
 *
 * This is the invariant that fixes the File Scope radios being permanently
 * greyed out once the log viewer has focus: VS Code fires
 * `onDidChangeActiveTextEditor` with `undefined` whenever focus moves to a
 * non-text surface (webviews, sidebar, settings UI). Before this guard, every
 * such firing rebuilt an all-null context and wiped the
 * workspace/package/directory/file paths the webview uses to decide which
 * radios to enable — which is exactly the moment the user needs them usable.
 *
 * @param editor The editor VS Code handed to the listener (or `undefined`).
 * @param broadcaster Receives the rebuilt scope context.
 * @param options.allowNullEditor When `true`, broadcast even if `editor` is
 *   undefined. Use for the initial seed (cold start with no file open shows the
 *   "Open a source file to enable scope filters" hint). When `false`, skip the
 *   broadcast so the previously-broadcast context stays in effect. Use for the
 *   listener firings — focus moving away from a text editor is not a reason to
 *   forget which editor the user last had open.
 */
export async function maybeBroadcastScopeContext(
    editor: vscode.TextEditor | undefined,
    broadcaster: ScopeContextBroadcaster,
    options: { readonly allowNullEditor: boolean },
): Promise<void> {
    if (!editor && !options.allowNullEditor) { return; }
    const ctx = await buildScopeContext(editor);
    broadcaster.setScopeContext(ctx);
}

/**
 * Setup scope context listener for source-scope filter.
 *
 * Seeds the webview with the current active editor's context on startup, then
 * re-broadcasts whenever the user moves to a different text editor. Ignores
 * `undefined` editor firings — see `maybeBroadcastScopeContext` for why.
 */
export function setupScopeContextListener(
    context: vscode.ExtensionContext,
    broadcaster: ViewerBroadcaster,
): void {
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            maybeBroadcastScopeContext(editor, broadcaster, { allowNullEditor: false })
                .catch(() => {});
        }),
    );
    // Initial seed: allow null so a cold start with no file open still shows
    // the webview's "Open a source file…" hint.
    maybeBroadcastScopeContext(vscode.window.activeTextEditor, broadcaster, { allowNullEditor: true })
        .catch(() => {});
}

/**
 * Setup diagnostic change listener for lint badge live updates.
 * When diagnostics change for files already seen in logs, broadcasts
 * updated lint counts to the webview.
 */
export function setupDiagnosticListener(
    context: vscode.ExtensionContext,
    diagnosticCache: DiagnosticCache,
    broadcaster: ViewerBroadcaster,
): void {
    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics((event) => {
            const updates = diagnosticCache.getUpdatesForChangedUris(event.uris);
            if (updates) {
                broadcaster.postToWebview({ type: 'updateLintData', fileUpdates: updates });
            }
        }),
    );
}
