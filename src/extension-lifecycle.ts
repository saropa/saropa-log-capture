/** Debug session lifecycle subscriptions (start / terminate). */

import * as os from 'os';
import * as vscode from 'vscode';
import { getConfig } from './modules/config';
import { loadPresets } from './modules/filter-presets';
import type { SessionManagerImpl } from './modules/session-manager';
import type { ViewerBroadcaster } from './ui/viewer-broadcaster';
import type { SessionHistoryProvider } from './ui/session-history-provider';
import type { InlineDecorationsProvider } from './ui/inline-decorations';
import type { LogViewerProvider } from './ui/log-viewer-provider';
import type { AiWatcher } from './modules/ai-watcher';
import { hasClaudeProject } from './modules/ai-session-resolver';

interface DebugLifecycleDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly broadcaster: ViewerBroadcaster;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
    readonly viewerProvider: LogViewerProvider;
    readonly updateSessionNav: () => Promise<void>;
    readonly aiWatcher: AiWatcher;
}

/** Register onDidStartDebugSession and onDidTerminateDebugSession handlers. */
export function registerDebugLifecycle(deps: DebugLifecycleDeps): void {
    const { context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider, updateSessionNav, aiWatcher } = deps;
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            broadcaster.setPaused(false);
            await sessionManager.startSession(session, context);
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
            if (cfg.showElapsedTime) { broadcaster.setShowElapsed(true); }
            if (cfg.showDecorations) { broadcaster.setShowDecorations(true); }
            broadcaster.setErrorClassificationSettings(
                cfg.suppressTransientErrors ?? false,
                cfg.breakOnCritical ?? false,
                cfg.levelDetection ?? "strict",
                cfg.deemphasizeFrameworkLevels ?? false
            );
            if (cfg.highlightRules.length > 0) { broadcaster.setHighlightRules(cfg.highlightRules); }
            broadcaster.setContextLines(cfg.filterContextLines);
            broadcaster.setContextViewLines(cfg.contextViewLines);
            broadcaster.setPresets(loadPresets());
            historyProvider.setActiveUri(activeSession?.fileUri);
            historyProvider.refresh();
            startAiWatcherIfEnabled(cfg, session, aiWatcher).catch(() => {});
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
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
