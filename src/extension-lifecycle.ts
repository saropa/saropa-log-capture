/** Debug session lifecycle subscriptions (start / terminate). */

import * as os from 'os';
import * as vscode from 'vscode';
import { getConfig } from './modules/config/config';
import { loadPresets } from './modules/storage/filter-presets';
import type { SessionManagerImpl } from './modules/session/session-manager';
import type { ViewerBroadcaster } from './ui/provider/viewer-broadcaster';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';
import type { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import type { LogViewerProvider } from './ui/provider/log-viewer-provider';
import type { AiWatcher } from './modules/ai/ai-watcher';
import { hasClaudeProject } from './modules/ai/ai-session-resolver';
import type { SaropaSessionEvent } from './api-types';

interface DebugLifecycleDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly broadcaster: ViewerBroadcaster;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
    readonly viewerProvider: LogViewerProvider;
    readonly updateSessionNav: () => Promise<void>;
    readonly aiWatcher: AiWatcher;
    readonly fireSessionStart: (event: SaropaSessionEvent) => void;
    readonly fireSessionEnd: (event: SaropaSessionEvent) => void;
}

/** Session ids we've already triggered a late start for (output arrived before onDidStartDebugSession). */
const lateStartTriggered = new Set<string>();

/** Apply UI state after a session has started (shared by onDidStartDebugSession and late-start fallback). */
function applySessionStartedState(
    deps: DebugLifecycleDeps,
    session: vscode.DebugSession,
): void {
    const { context, sessionManager, broadcaster, historyProvider, viewerProvider, aiWatcher, fireSessionStart } = deps;
    const activeSession = sessionManager.getActiveSession();
    const filename = sessionManager.getActiveFilename();
    if (filename) { broadcaster.setFilename(filename); }
    broadcaster.setSessionActive(true);
    viewerProvider.setSessionNavInfo(false, false, 0, 0);
    if (activeSession?.fileUri) { broadcaster.setCurrentFile(activeSession.fileUri); }
    broadcaster.setSplitInfo(1, 1);
    broadcaster.setSessionInfo({
        'Date': new Date().toISOString(),
        'Project': session.workspaceFolder?.name ?? 'Unknown',
        'Debug Adapter': session.type,
        'launch.json': session.configuration.name,
        'VS Code': vscode.version,
        'Extension': `saropa-log-capture v${context.extension.packageJSON.version ?? '0.0.0'}`,
        'OS': `${os.type()} ${os.release()} (${os.arch()})`,
    });
    const cfg = getConfig();
    if (cfg.exclusions.length > 0) { broadcaster.setExclusions(cfg.exclusions); }
    if (cfg.autoHidePatterns.length > 0) { broadcaster.setAutoHidePatterns(cfg.autoHidePatterns); }
    if (cfg.showElapsedTime) { broadcaster.setShowElapsed(true); }
    broadcaster.setErrorClassificationSettings(
        cfg.suppressTransientErrors ?? false,
        cfg.breakOnCritical ?? false,
        cfg.levelDetection ?? "strict",
        cfg.deemphasizeFrameworkLevels ?? false,
        cfg.stderrTreatAsError,
    );
    if (cfg.highlightRules.length > 0) { broadcaster.setHighlightRules(cfg.highlightRules); }
    broadcaster.setContextLines(cfg.filterContextLines);
    broadcaster.setContextViewLines(cfg.contextViewLines);
    broadcaster.setCopyContextLines(cfg.copyContextLines);
    broadcaster.setPresets(loadPresets());
    historyProvider.setActiveUri(activeSession?.fileUri);
    historyProvider.refresh();
    fireSessionStart({
        debugSessionId: session.id,
        debugAdapterType: session.type,
        projectName: session.workspaceFolder?.name ?? 'Unknown',
        fileUri: activeSession?.fileUri,
    });
    startAiWatcherIfEnabled(cfg, session, aiWatcher).catch(() => {});
}

/** Register onDidStartDebugSession and onDidTerminateDebugSession handlers. */
export function registerDebugLifecycle(deps: DebugLifecycleDeps): void {
    const { context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider: _viewerProvider, updateSessionNav, aiWatcher, fireSessionStart: _fireSessionStart, fireSessionEnd } = deps;

    // When output is buffered and no log session exists (e.g. Dart/Cursor never fired onDidStartDebugSession),
    // try to start capture using the active debug session so dart run and similar still get logs.
    sessionManager.setOnOutputBufferedWithNoSession((sessionId: string) => {
        const active = vscode.debug.activeDebugSession;
        if (!active || active.id !== sessionId) { return; }
        if (lateStartTriggered.has(sessionId)) { return; }
        lateStartTriggered.add(sessionId);
        void sessionManager.startSession(active, context).then(() => {
            broadcaster.setPaused(false);
            applySessionStartedState(deps, active);
        }).catch(() => { /* avoid unhandled rejection if startSession fails */ });
    });

    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            broadcaster.setPaused(false);
            await sessionManager.startSession(session, context);
            applySessionStartedState(deps, session);
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            lateStartTriggered.delete(session.id);
            // Fire API event before stopping so fileUri is still valid for consumers.
            const ending = sessionManager.getActiveSession();
            fireSessionEnd({
                debugSessionId: session.id,
                debugAdapterType: session.type,
                projectName: session.workspaceFolder?.name ?? 'Unknown',
                fileUri: ending?.fileUri,
            });
            // Session end: stop session, clear broadcaster/history/decorations, update nav.
            await sessionManager.stopSession(session);
            broadcaster.setSessionActive(false);
            historyProvider.setActiveUri(undefined);
            historyProvider.refresh();
            inlineDecorations.clearAll();
            updateSessionNav().catch(() => {});
            aiWatcher.stop();
        }),
    );
}

async function startAiWatcherIfEnabled(
    cfg: ReturnType<typeof getConfig>,
    session: vscode.DebugSession,
    aiWatcher: AiWatcher,
): Promise<void> {
    const ai = cfg.aiActivity;
    if (!ai.enabled && !ai.autoDetect) { return; }
    const workspacePath = session.workspaceFolder?.uri.fsPath;
    if (!workspacePath) { return; }
    if (!ai.enabled && ai.autoDetect) {
        const hasProject = await hasClaudeProject(workspacePath);
        if (!hasProject) { return; }
    }
    const lookbackMs = ai.lookbackMinutes * 60 * 1000;
    await aiWatcher.start(workspacePath, { lookbackMs });
}
