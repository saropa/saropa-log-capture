"use strict";
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
exports.SessionManagerImpl = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const flood_guard_1 = require("../capture/flood-guard");
const session_metadata_1 = require("./session-metadata");
const session_event_bus_1 = require("./session-event-bus");
const session_manager_events_1 = require("./session-manager-events");
const session_manager_routing_1 = require("./session-manager-routing");
const session_manager_start_1 = require("./session-manager-start");
const session_manager_stop_1 = require("./session-manager-stop");
const session_manager_internals_1 = require("./session-manager-internals");
/**
 * Manages active debug log sessions, bridges DAP output to LogSession,
 * and broadcasts written lines to registered listeners (e.g. sidebar viewer).
 */
class SessionManagerImpl {
    statusBar;
    outputChannel;
    sessions = new Map();
    /** Debug session id -> debug target process ID (from DAP process event). */
    processIds = new Map();
    /** Child session id -> parent session id. Used when child starts before parent (e.g. Dart VM before Flutter). */
    childToParentId = new Map();
    /** Owner session id -> creation time (ms). Used for fallback when child has no parentSession set. */
    ownerSessionCreatedAt = new Map();
    ownerSessionIds = new Set();
    /** Session ids we've already logged "buffering output" for (avoid log spam). */
    bufferingLoggedFor = new Set();
    /** Session ids we've logged "output written" for (diagnosticCapture, once per session). */
    diagnosticWrittenLoggedFor = new Set();
    /** First time we buffered output for a session id (for timeout warning). */
    firstBufferTime = new Map();
    /** Session ids we've already warned about buffer timeout (once per id). */
    bufferTimeoutWarnedFor = new Set();
    lineListeners = [];
    splitListeners = [];
    watcher;
    floodGuard = new flood_guard_1.FloodGuard();
    exclusionRules = [];
    categoryCounts = {};
    sessionStartTime = 0;
    floodSuppressedTotal = 0;
    autoTagger = null;
    metadataStore = new session_metadata_1.SessionMetadataStore();
    earlyBuffer = new session_event_bus_1.EarlyOutputBuffer();
    /** Called when output is buffered and no log session exists (e.g. Dart/Cursor never fired onDidStartDebugSession). */
    onOutputBufferedWithNoSession;
    /** Cached config snapshot — avoids 30+ cfg.get() calls per DAP message. */
    cachedConfig = (0, config_1.getConfig)();
    projectIndexer = null;
    constructor(statusBar, outputChannel) {
        this.statusBar = statusBar;
        this.outputChannel = outputChannel;
        this.watcher = (0, session_manager_internals_1.createWatcher)();
    }
    /** Refresh the cached config (call on settings change). */
    refreshConfig(config) {
        this.cachedConfig = config ?? (0, config_1.getConfig)();
    }
    /** Set project indexer for inline reports index updates after session finalization. */
    setProjectIndexer(indexer) {
        this.projectIndexer = indexer;
    }
    /**
     * When output is buffered and no log session exists (e.g. onDidStartDebugSession never fired for this adapter),
     * the extension can try to start capture using the active debug session. Set by extension-lifecycle.
     */
    setOnOutputBufferedWithNoSession(callback) {
        this.onOutputBufferedWithNoSession = callback;
    }
    get activeSessionCount() { return this.ownerSessionIds.size; }
    /** Register a listener that receives every line written to the log. */
    addLineListener(listener) { this.lineListeners.push(listener); }
    /** Remove a previously registered line listener. */
    removeLineListener(listener) {
        const idx = this.lineListeners.indexOf(listener);
        if (idx >= 0) {
            this.lineListeners.splice(idx, 1);
        }
    }
    /** Register a listener for file split events. */
    addSplitListener(listener) { this.splitListeners.push(listener); }
    /** Remove a previously registered split listener. */
    removeSplitListener(listener) {
        const idx = this.splitListeners.indexOf(listener);
        if (idx >= 0) {
            this.splitListeners.splice(idx, 1);
        }
    }
    /** Called by the DAP tracker for every output event. */
    onOutputEvent(sessionId, body) {
        const effectiveSessionId = (0, session_manager_routing_1.resolveEffectiveSessionId)(sessionId, {
            sessions: this.sessions,
            ownerSessionIds: this.ownerSessionIds,
            ownerSessionCreatedAt: this.ownerSessionCreatedAt,
            bufferingLoggedFor: this.bufferingLoggedFor,
            bufferTimeoutWarnedFor: this.bufferTimeoutWarnedFor,
            firstBufferTime: this.firstBufferTime,
            diagnosticWrittenLoggedFor: this.diagnosticWrittenLoggedFor,
            config: this.cachedConfig,
            outputChannel: this.outputChannel,
            onOutputBufferedWithNoSession: this.onOutputBufferedWithNoSession,
            getMostRecentOwnerSessionId: () => this.getMostRecentOwnerSessionId(),
        });
        const counters = { categoryCounts: this.categoryCounts, floodSuppressedTotal: this.floodSuppressedTotal };
        (0, session_manager_events_1.processOutputEvent)({ sessions: this.sessions, earlyBuffer: this.earlyBuffer, config: this.cachedConfig, exclusionRules: this.exclusionRules, floodGuard: this.floodGuard }, { counters, broadcastLine: (data) => this.broadcastLine(data) }, effectiveSessionId, body);
        this.floodSuppressedTotal = counters.floodSuppressedTotal;
    }
    /** Called by the DAP tracker for all protocol messages (verbose mode). */
    onDapMessage(sessionId, msg, direction) {
        (0, session_manager_events_1.processDapMessage)({ config: this.cachedConfig, sessions: this.sessions }, sessionId, msg, direction);
    }
    /** Called by the DAP tracker when a process event with systemProcessId is received. */
    onProcessId(sessionId, processId) {
        this.processIds.set(sessionId, processId);
    }
    /** Start capturing a debug session. */
    async startSession(session, context) {
        this.cachedConfig = (0, config_1.getConfig)();
        const deps = {
            config: this.cachedConfig,
            sessions: this.sessions,
            ownerSessionIds: this.ownerSessionIds,
            ownerSessionCreatedAt: this.ownerSessionCreatedAt,
            childToParentId: this.childToParentId,
            earlyBuffer: this.earlyBuffer,
            outputChannel: this.outputChannel,
            getSingleRecentOwnerSession: (windowMs) => this.getSingleRecentOwnerSession(windowMs),
            statusBar: this.statusBar,
            broadcastSplit: (uri, totalParts) => this.broadcastSplit(uri, totalParts),
            onOutputEvent: (id, b) => this.onOutputEvent(id, b),
            clearBufferTimeoutState: () => this.clearBufferTimeoutState(),
        };
        const outcome = await (0, session_manager_start_1.startSessionImpl)(session, context, deps);
        if (outcome.kind === 'aliased' || outcome.kind === 'skipped') {
            return;
        }
        const onOut = (id, b) => this.onOutputEvent(id, b);
        (0, session_manager_internals_1.applyStartResult)({
            sessions: this.sessions, ownerSessionIds: this.ownerSessionIds, ownerSessionCreatedAt: this.ownerSessionCreatedAt,
            childToParentId: this.childToParentId, earlyBuffer: this.earlyBuffer, outputChannel: this.outputChannel,
            config: this.cachedConfig, onOutputEvent: onOut, clearBufferTimeoutState: () => this.clearBufferTimeoutState(),
            statusBar: this.statusBar, setExclusionRules: (r) => { this.exclusionRules = r; }, setAutoTagger: (a) => { this.autoTagger = a; },
            floodGuard: this.floodGuard, categoryCounts: this.categoryCounts,
            setSessionStartTime: (v) => { this.sessionStartTime = v; }, setFloodSuppressedTotal: (v) => { this.floodSuppressedTotal = v; },
        }, session, outcome.result);
    }
    /** Stop and finalize a debug session's log file. */
    async stopSession(session) {
        // Cast: buildStopSessionDeps expects public shape; we pass this (private fields match at runtime).
        await (0, session_manager_stop_1.stopSessionImpl)(session, (0, session_manager_stop_1.buildStopSessionDeps)(this));
    }
    /** Get the active LogSession for the current debug session. */
    getActiveSession() {
        const active = vscode.debug.activeDebugSession;
        return active ? this.sessions.get(active.id) : undefined;
    }
    /** Last write time (ms since epoch) for the active session. */
    getActiveLastWriteTime() { return this.getActiveSession()?.lastWriteTime; }
    /** Get the log file path for the active session (relative or full). */
    getActiveFilename() {
        const uri = this.getActiveSession()?.fileUri;
        return uri ? vscode.workspace.asRelativePath(uri, false) : undefined;
    }
    /** Check if a debug session already has an active log session. */
    hasSession(sessionId) { return this.sessions.has(sessionId); }
    /** Write one or more lines into the active log session (public API). */
    writeLine(text, category, timestamp) {
        const session = this.getActiveSession();
        if (!session) {
            return;
        }
        const counters = { categoryCounts: this.categoryCounts, floodSuppressedTotal: this.floodSuppressedTotal };
        (0, session_manager_events_1.processApiWriteLine)({ config: this.cachedConfig, exclusionRules: this.exclusionRules, floodGuard: this.floodGuard }, { counters, broadcastLine: (data) => this.broadcastLine(data) }, { session, text, category, timestamp });
        this.floodSuppressedTotal = counters.floodSuppressedTotal;
    }
    /** Insert a visual marker into the active log session. */
    insertMarker(customText) {
        const logSession = this.getActiveSession();
        if (!logSession) {
            return;
        }
        const markerText = logSession.appendMarker(customText);
        if (markerText) {
            this.broadcastLine({
                text: markerText, isMarker: true, lineCount: logSession.lineCount,
                category: 'marker', timestamp: new Date(),
            });
        }
    }
    /** Toggle pause/resume on the active session. Returns the new paused state. */
    togglePause() {
        const logSession = this.getActiveSession();
        if (!logSession) {
            return undefined;
        }
        if (logSession.state === 'recording') {
            logSession.pause();
            this.statusBar.setPaused(true);
            return true;
        }
        if (logSession.state === 'paused') {
            logSession.resume();
            this.statusBar.setPaused(false);
            return false;
        }
        return undefined;
    }
    /** Clear the active session's line count and viewer. */
    clearActiveSession() {
        const logSession = this.getActiveSession();
        if (!logSession) {
            return;
        }
        logSession.clear();
        this.statusBar.updateLineCount(0);
    }
    /** Stop all sessions (called on deactivate). */
    async stopAll() {
        this.earlyBuffer.clear();
        this.childToParentId.clear();
        this.ownerSessionCreatedAt.clear();
        this.bufferingLoggedFor.clear();
        this.clearBufferTimeoutState();
        const unique = new Set(this.sessions.values());
        await Promise.allSettled([...unique].map(s => s.stop()));
        this.sessions.clear();
        this.ownerSessionIds.clear();
    }
    /** Get the keyword watcher instance (for external access to counts). */
    getWatcher() { return this.watcher; }
    /** Recreate the keyword watcher from current config. */
    refreshWatcher() { this.watcher = (0, session_manager_internals_1.createWatcher)(); }
    getSingleRecentOwnerSession(windowMs) {
        return (0, session_manager_internals_1.getSingleRecentOwnerSession)(this.ownerSessionIds, this.ownerSessionCreatedAt, this.sessions, windowMs);
    }
    clearBufferTimeoutState() {
        (0, session_manager_internals_1.clearBufferTimeoutState)(this.firstBufferTime, this.bufferTimeoutWarnedFor);
    }
    getMostRecentOwnerSessionId() {
        return (0, session_manager_internals_1.getMostRecentOwnerSessionId)(this.ownerSessionIds, this.ownerSessionCreatedAt, this.sessions);
    }
    broadcastLine(data) {
        (0, session_manager_internals_1.broadcastLine)(data, {
            watcher: this.watcher,
            lineListeners: this.lineListeners,
            statusBar: this.statusBar,
            autoTagger: this.autoTagger,
        });
    }
    broadcastSplit(newUri, totalParts) {
        (0, session_manager_internals_1.broadcastSplit)(newUri, totalParts, this.splitListeners);
    }
}
exports.SessionManagerImpl = SessionManagerImpl;
//# sourceMappingURL=session-manager.js.map