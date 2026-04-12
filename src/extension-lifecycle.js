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
exports.registerDebugLifecycle = registerDebugLifecycle;
const os = __importStar(require("os"));
const vscode = __importStar(require("vscode"));
const config_1 = require("./modules/config/config");
const level_classifier_1 = require("./modules/analysis/level-classifier");
const filter_presets_1 = require("./modules/storage/filter-presets");
const ai_session_resolver_1 = require("./modules/ai/ai-session-resolver");
/** Session ids we've already triggered a late start for (output arrived before onDidStartDebugSession). */
const lateStartTriggered = new Set();
/** Apply UI state after a session has started (shared by onDidStartDebugSession and late-start fallback). */
function applySessionStartedState(deps, session) {
    const { context, sessionManager, broadcaster, historyProvider, viewerProvider, aiWatcher, fireSessionStart } = deps;
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
    const { context, sessionManager, broadcaster, historyProvider, inlineDecorations, viewerProvider: _viewerProvider, updateSessionNav, aiWatcher, fireSessionStart: _fireSessionStart, fireSessionEnd } = deps;
    // When output is buffered and no log session exists (e.g. Dart/Cursor never fired onDidStartDebugSession),
    // try to start capture using the active debug session so dart run and similar still get logs.
    sessionManager.setOnOutputBufferedWithNoSession((sessionId) => {
        const active = vscode.debug.activeDebugSession;
        if (!active || active.id !== sessionId) {
            return;
        }
        if (lateStartTriggered.has(sessionId)) {
            return;
        }
        lateStartTriggered.add(sessionId);
        void sessionManager.startSession(active, context).then(() => {
            broadcaster.setPaused(false);
            applySessionStartedState(deps, active);
        }).catch(() => { });
    });
    context.subscriptions.push(vscode.debug.onDidStartDebugSession(async (session) => {
        broadcaster.setPaused(false);
        await sessionManager.startSession(session, context);
        applySessionStartedState(deps, session);
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
        // Session end: stop session, clear broadcaster/history/decorations, update nav.
        await sessionManager.stopSession(session);
        broadcaster.setSessionActive(false);
        historyProvider.setActiveUri(undefined);
        historyProvider.refresh();
        inlineDecorations.clearAll();
        updateSessionNav().catch(() => { });
        aiWatcher.stop();
    }));
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