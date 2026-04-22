"use strict";
/** Debug session lifecycle subscriptions (start / terminate). */
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
exports.applySessionStartedState = applySessionStartedState;
exports.registerDebugLifecycle = registerDebugLifecycle;
const os = __importStar(require("os"));
const vscode = __importStar(require("vscode"));
const config_1 = require("./modules/config/config");
const level_classifier_1 = require("./modules/analysis/level-classifier");
const filter_presets_1 = require("./modules/storage/filter-presets");
const ai_session_resolver_1 = require("./modules/ai/ai-session-resolver");
const viewer_handler_wiring_1 = require("./ui/provider/viewer-handler-wiring");
/** Session ids we've already triggered a late start for (output arrived before onDidStartDebugSession). */
const lateStartTriggered = new Set();
/**
 * Apply UI state after a session has started (shared by onDidStartDebugSession and late-start fallback).
 * Exported for testing — not intended for external callers.
 * @internal
 */
function applySessionStartedState(deps, session) {
    const { context, sessionManager, broadcaster, historyProvider, viewerProvider, aiWatcher, fireSessionStart, sessionGroupTracker } = deps;
    const activeSession = sessionManager.getActiveSession();
    const filename = sessionManager.getActiveFilename();
    if (filename) {
        broadcaster.setFilename(filename);
    }
    broadcaster.setSessionActive(true);
    viewerProvider.setSessionNavInfo(false, false, 0, 0);
    if (activeSession?.fileUri) {
        broadcaster.setCurrentFile(activeSession.fileUri);
    }
    // Anchor a session group on this DAP session. Fire-and-forget: grouping is best-effort and
    // must not delay or fail session startup. The tracker swallows and logs its own errors.
    if (activeSession?.fileUri) {
        sessionGroupTracker.onDapSessionStart(activeSession.fileUri, Date.now()).catch(() => { });
    }
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
    const cfg = (0, config_1.getConfig)();
    if (cfg.exclusions.length > 0) {
        broadcaster.setExclusions(cfg.exclusions);
    }
    if (cfg.autoHidePatterns.length > 0) {
        broadcaster.setAutoHidePatterns(cfg.autoHidePatterns);
    }
    if (cfg.showElapsedTime) {
        broadcaster.setShowElapsed(true);
    }
    (0, level_classifier_1.setSeverityKeywords)(cfg.severityKeywords);
    broadcaster.setErrorClassificationSettings({
        suppressTransientErrors: cfg.suppressTransientErrors ?? false,
        breakOnCritical: cfg.breakOnCritical ?? false,
        levelDetection: cfg.levelDetection ?? "strict",
        stderrTreatAsError: cfg.stderrTreatAsError,
        severityKeywords: cfg.severityKeywords,
    });
    if (cfg.highlightRules.length > 0) {
        broadcaster.setHighlightRules(cfg.highlightRules);
    }
    broadcaster.setContextLines(cfg.filterContextLines);
    broadcaster.setContextViewLines(cfg.contextViewLines);
    broadcaster.setCopyContextLines(cfg.copyContextLines);
    broadcaster.setPresets((0, filter_presets_1.loadPresets)());
    // Clear any stale Logs panel root override so the panel reverts to the
    // workspace default — which matches the session's log directory for standalone
    // workspaces. Without this, a folder previously chosen via "Browse" persists
    // across debug sessions and shows logs from a different project.
    context.workspaceState.update(viewer_handler_wiring_1.SESSION_PANEL_ROOT_KEY, undefined);
    historyProvider.setActiveUri(activeSession?.fileUri);
    historyProvider.refresh();
    fireSessionStart({
        debugSessionId: session.id,
        debugAdapterType: session.type,
        projectName: session.workspaceFolder?.name ?? 'Unknown',
        fileUri: activeSession?.fileUri,
    });
    startAiWatcherIfEnabled(cfg, session, aiWatcher).catch(() => { });
}
/** Register onDidStartDebugSession and onDidTerminateDebugSession handlers. */
function registerDebugLifecycle(deps) {
    const { context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider: _viewerProvider, updateSessionNav, aiWatcher, fireSessionStart: _fireSessionStart, fireSessionEnd, sessionGroupTracker } = deps;
    // When output is buffered and no log session exists (e.g. Dart/Cursor never fired onDidStartDebugSession),
    // try to start capture using the active debug session so dart run and similar still get logs.
    // NOTE: Don't require active.id === sessionId — Flutter creates parent + child sessions with
    // different IDs. Output arrives on the child (Dart VM) but activeDebugSession is the parent
    // (Flutter). An exact-match check would silently skip capture for the entire session.
    sessionManager.setOnOutputBufferedWithNoSession((_sessionId) => {
        const active = vscode.debug.activeDebugSession;
        if (!active) {
            return;
        }
        if (lateStartTriggered.has(active.id)) {
            return;
        }
        lateStartTriggered.add(active.id);
        void sessionManager.startSession(active, context).then(() => {
            broadcaster.setPaused(false);
            applySessionStartedState(deps, active);
        }).catch(() => { });
    });
    context.subscriptions.push(vscode.debug.onDidStartDebugSession(async (session) => {
        try {
            broadcaster.setPaused(false);
            await sessionManager.startSession(session, context);
            applySessionStartedState(deps, session);
        }
        catch (err) {
            // Log failures — without this, async rejections are silently swallowed by VS Code's
            // event infrastructure and the session is invisibly dropped.
            const msg = err instanceof Error ? err.message : String(err);
            sessionManager.logToOutputChannel(`onDidStartDebugSession failed: ${msg} (type=${session.type} id=${session.id})`);
        }
    }), vscode.debug.onDidTerminateDebugSession(async (session) => {
        lateStartTriggered.delete(session.id);
        // Fire API event before stopping so fileUri is still valid for consumers.
        const ending = sessionManager.getActiveSession();
        fireSessionEnd({
            debugSessionId: session.id,
            debugAdapterType: session.type,
            projectName: session.workspaceFolder?.name ?? 'Unknown',
            fileUri: ending?.fileUri,
        });
        // Close the session group before stopSession() runs \u2014 the sweep re-scans the log
        // directory to catch sidecars that integration providers wrote during the session
        // (e.g. adb-logcat.ts:onSessionEnd creates `.logcat.log` at this moment).
        // Best-effort: failures here must not block the session stop flow.
        if (ending?.fileUri) {
            await sessionGroupTracker.onDapSessionEnd(ending.fileUri).catch(() => { });
        }
        // Session end: stop session, clear broadcaster/history/decorations, update nav.
        await sessionManager.stopSession(session);
        broadcaster.setSessionActive(false);
        historyProvider.setActiveUri(undefined);
        historyProvider.refresh();
        inlineDecorations.clearAll();
        updateSessionNav().catch(() => { });
        aiWatcher.stop();
    }));
    // Attach to a debug session that was already running before the extension activated.
    // Covers window reload, extension host restart, and late activation scenarios where
    // onDidStartDebugSession never fires for the existing session.
    attachToExistingSession(deps);
}
/**
 * If a debug session is already active when the extension activates (e.g. after
 * a window reload or extension host restart), start capture for it immediately.
 * Without this, onDidStartDebugSession never fires for the pre-existing session
 * and the log is invisible in the Logs panel.
 */
function attachToExistingSession(deps) {
    const { context, sessionManager, broadcaster } = deps;
    const active = vscode.debug.activeDebugSession;
    if (!active) {
        return;
    }
    if (sessionManager.hasSession(active.id)) {
        return;
    }
    // Mark as late-start so the buffered-output callback doesn't race with us.
    lateStartTriggered.add(active.id);
    void sessionManager.startSession(active, context).then(() => {
        broadcaster.setPaused(false);
        applySessionStartedState(deps, active);
    }).catch(() => { });
}
async function startAiWatcherIfEnabled(cfg, session, aiWatcher) {
    const ai = cfg.aiActivity;
    if (!ai.enabled && !ai.autoDetect) {
        return;
    }
    const workspacePath = session.workspaceFolder?.uri.fsPath;
    if (!workspacePath) {
        return;
    }
    if (!ai.enabled && ai.autoDetect) {
        const hasProject = await (0, ai_session_resolver_1.hasClaudeProject)(workspacePath);
        if (!hasProject) {
            return;
        }
    }
    const lookbackMs = ai.lookbackMinutes * 60 * 1000;
    await aiWatcher.start(workspacePath, { lookbackMs });
}
//# sourceMappingURL=extension-lifecycle.js.map