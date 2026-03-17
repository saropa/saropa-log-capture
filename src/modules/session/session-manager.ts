import * as vscode from 'vscode';
import { getConfig, SaropaLogCaptureConfig } from '../config/config';
import { SessionManager, DapOutputBody } from '../capture/tracker';
import { LogSession } from '../capture/log-session';
import { StatusBar } from '../../ui/shared/status-bar';
import { KeywordWatcher } from '../features/keyword-watcher';
import { FloodGuard } from '../capture/flood-guard';
import { ExclusionRule } from '../features/exclusion-matcher';
import { AutoTagger } from '../misc/auto-tagger';
import { DapDirection } from '../capture/dap-formatter';
import { SessionMetadataStore } from './session-metadata';
import { LineData, LineListener, SplitListener, EarlyOutputBuffer } from './session-event-bus';
import { processOutputEvent, processApiWriteLine, processDapMessage } from './session-manager-events';
import { resolveEffectiveSessionId } from './session-manager-routing';
import { startSessionImpl, type StartSessionDeps } from './session-manager-start';
import { stopSessionImpl, type StopSessionDeps } from './session-manager-stop';
import { replayEarlyBuffer, replayAllOtherEarlyBuffers } from './session-manager-replay';
import type { ProjectIndexer } from '../project-indexer/project-indexer';
export { LineData, LineListener, SplitListener };

/**
 * Manages active debug log sessions, bridges DAP output to LogSession,
 * and broadcasts written lines to registered listeners (e.g. sidebar viewer).
 */
export class SessionManagerImpl implements SessionManager {
    private readonly sessions = new Map<string, LogSession>();
    /** Debug session id -> debug target process ID (from DAP process event). */
    private readonly processIds = new Map<string, number>();
    /** Child session id -> parent session id. Used when child starts before parent (e.g. Dart VM before Flutter). */
    private readonly childToParentId = new Map<string, string>();
    /** Owner session id -> creation time (ms). Used for fallback when child has no parentSession set. */
    private readonly ownerSessionCreatedAt = new Map<string, number>();
    private readonly ownerSessionIds = new Set<string>();
    /** Session ids we've already logged "buffering output" for (avoid log spam). */
    private readonly bufferingLoggedFor = new Set<string>();
    /** Session ids we've logged "output written" for (diagnosticCapture, once per session). */
    private readonly diagnosticWrittenLoggedFor = new Set<string>();
    /** First time we buffered output for a session id (for timeout warning). */
    private readonly firstBufferTime = new Map<string, number>();
    /** Session ids we've already warned about buffer timeout (once per id). */
    private readonly bufferTimeoutWarnedFor = new Set<string>();
    private readonly lineListeners: LineListener[] = [];
    private readonly splitListeners: SplitListener[] = [];
    private watcher: KeywordWatcher;
    private readonly floodGuard = new FloodGuard();
    private exclusionRules: ExclusionRule[] = [];
    private categoryCounts: Record<string, number> = {};
    private sessionStartTime = 0;
    private floodSuppressedTotal = 0;
    private autoTagger: AutoTagger | null = null;
    private readonly metadataStore = new SessionMetadataStore();
    private readonly earlyBuffer = new EarlyOutputBuffer();
    /** Called when output is buffered and no log session exists (e.g. Dart/Cursor never fired onDidStartDebugSession). */
    private onOutputBufferedWithNoSession: ((sessionId: string) => void) | undefined;
    /** Cached config snapshot — avoids 30+ cfg.get() calls per DAP message. */
    private cachedConfig: SaropaLogCaptureConfig = getConfig();
    private projectIndexer: ProjectIndexer | null = null;

    constructor(
        private readonly statusBar: StatusBar,
        private readonly outputChannel: vscode.OutputChannel,
    ) {
        this.watcher = this.createWatcher();
    }

    /** Refresh the cached config (call on settings change). */
    refreshConfig(config?: SaropaLogCaptureConfig): void {
        this.cachedConfig = config ?? getConfig();
    }

    /** Set project indexer for inline reports index updates after session finalization. */
    setProjectIndexer(indexer: ProjectIndexer | null): void {
        this.projectIndexer = indexer;
    }

    /**
     * When output is buffered and no log session exists (e.g. onDidStartDebugSession never fired for this adapter),
     * the extension can try to start capture using the active debug session. Set by extension-lifecycle.
     */
    setOnOutputBufferedWithNoSession(callback: ((sessionId: string) => void) | undefined): void {
        this.onOutputBufferedWithNoSession = callback;
    }

    get activeSessionCount(): number { return this.ownerSessionIds.size; }

    /** Register a listener that receives every line written to the log. */
    addLineListener(listener: LineListener): void { this.lineListeners.push(listener); }

    /** Remove a previously registered line listener. */
    removeLineListener(listener: LineListener): void {
        const idx = this.lineListeners.indexOf(listener);
        if (idx >= 0) { this.lineListeners.splice(idx, 1); }
    }

    /** Register a listener for file split events. */
    addSplitListener(listener: SplitListener): void { this.splitListeners.push(listener); }

    /** Remove a previously registered split listener. */
    removeSplitListener(listener: SplitListener): void {
        const idx = this.splitListeners.indexOf(listener);
        if (idx >= 0) { this.splitListeners.splice(idx, 1); }
    }

    /** Called by the DAP tracker for every output event. */
    onOutputEvent(sessionId: string, body: DapOutputBody): void {
        const effectiveSessionId = resolveEffectiveSessionId(sessionId, {
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
        processOutputEvent(
            { sessions: this.sessions, earlyBuffer: this.earlyBuffer, config: this.cachedConfig, exclusionRules: this.exclusionRules, floodGuard: this.floodGuard },
            { counters, broadcastLine: (data) => this.broadcastLine(data) }, effectiveSessionId, body,
        );
        this.floodSuppressedTotal = counters.floodSuppressedTotal;
    }

    /** Called by the DAP tracker for all protocol messages (verbose mode). */
    onDapMessage(sessionId: string, msg: unknown, direction: DapDirection): void {
        processDapMessage({ config: this.cachedConfig, sessions: this.sessions }, sessionId, msg, direction);
    }

    /** Called by the DAP tracker when a process event with systemProcessId is received. */
    onProcessId(sessionId: string, processId: number): void {
        this.processIds.set(sessionId, processId);
    }

    /** Start capturing a debug session. */
    async startSession(
        session: vscode.DebugSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        this.cachedConfig = getConfig();
        const deps: StartSessionDeps = {
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
        const outcome = await startSessionImpl(session, context, deps);
        if (outcome.kind === 'aliased' || outcome.kind === 'skipped') { return; }
        const result = outcome.result;
        if (this.cachedConfig.diagnosticCapture) {
            this.outputChannel.appendLine(`Capture diagnostic: new log session created sessionId=${session.id} type=${session.type}`);
        }
        this.sessions.set(session.id, result.logSession);
        this.ownerSessionIds.add(session.id);
        this.ownerSessionCreatedAt.set(session.id, Date.now());
        if (session.parentSession) {
            this.childToParentId.set(session.id, session.parentSession.id);
        }
        this.exclusionRules = result.exclusionRules;
        this.autoTagger = result.autoTagger;
        this.floodGuard.reset();
        this.categoryCounts = {};
        this.sessionStartTime = Date.now();
        this.floodSuppressedTotal = 0;
        this.statusBar.show();
        replayEarlyBuffer(this.earlyBuffer, session.id, (id, b) => this.onOutputEvent(id, b), this.outputChannel);
        replayAllOtherEarlyBuffers({ earlyBuffer: this.earlyBuffer, sessionId: session.id, onOutput: (id, b) => this.onOutputEvent(id, b), config: this.cachedConfig, outputChannel: this.outputChannel });
        this.clearBufferTimeoutState();
    }

    /** Stop and finalize a debug session's log file. */
    async stopSession(session: vscode.DebugSession): Promise<void> {
        await stopSessionImpl(session, {
            earlyBuffer: this.earlyBuffer,
            childToParentId: this.childToParentId,
            ownerSessionCreatedAt: this.ownerSessionCreatedAt,
            bufferingLoggedFor: this.bufferingLoggedFor,
            diagnosticWrittenLoggedFor: this.diagnosticWrittenLoggedFor,
            firstBufferTime: this.firstBufferTime,
            bufferTimeoutWarnedFor: this.bufferTimeoutWarnedFor,
            sessions: this.sessions,
            processIds: this.processIds,
            ownerSessionIds: this.ownerSessionIds,
            sessionStartTime: this.sessionStartTime,
            categoryCounts: this.categoryCounts,
            watcher: this.watcher,
            floodSuppressedTotal: this.floodSuppressedTotal,
            outputChannel: this.outputChannel,
            statusBar: this.statusBar,
            metadataStore: this.metadataStore,
            autoTagger: this.autoTagger,
            projectIndexer: this.projectIndexer,
        } as StopSessionDeps);
    }

    /** Get the active LogSession for the current debug session. */
    getActiveSession(): LogSession | undefined {
        const active = vscode.debug.activeDebugSession;
        return active ? this.sessions.get(active.id) : undefined;
    }

    /** Last write time (ms since epoch) for the active session; used for "updated in last minute" indicator. */
    getActiveLastWriteTime(): number | undefined {
        return this.getActiveSession()?.lastWriteTime;
    }

    /** Get the log file path for the active session (relative or full). */
    getActiveFilename(): string | undefined {
        const uri = this.getActiveSession()?.fileUri;
        if (!uri) { return undefined; }
        return vscode.workspace.asRelativePath(uri, false);
    }

    /** Check if a debug session already has an active log session. */
    hasSession(sessionId: string): boolean { return this.sessions.has(sessionId); }

    /** Write one or more lines into the active log session (public API). */
    writeLine(text: string, category: string, timestamp: Date): void {
        const session = this.getActiveSession();
        if (!session) { return; }
        const counters = { categoryCounts: this.categoryCounts, floodSuppressedTotal: this.floodSuppressedTotal };
        processApiWriteLine(
            { config: this.cachedConfig, exclusionRules: this.exclusionRules, floodGuard: this.floodGuard },
            { counters, broadcastLine: (data) => this.broadcastLine(data) },
            { session, text, category, timestamp },
        );
        this.floodSuppressedTotal = counters.floodSuppressedTotal;
    }

    /** Insert a visual marker into the active log session. */
    insertMarker(customText?: string): void {
        const logSession = this.getActiveSession();
        if (!logSession) { return; }
        const markerText = logSession.appendMarker(customText);
        if (markerText) {
            this.broadcastLine({
                text: markerText, isMarker: true, lineCount: logSession.lineCount,
                category: 'marker', timestamp: new Date(),
            });
        }
    }

    /** Toggle pause/resume on the active session. Returns the new paused state. */
    togglePause(): boolean | undefined {
        const logSession = this.getActiveSession();
        if (!logSession) { return undefined; }
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
    clearActiveSession(): void {
        const logSession = this.getActiveSession();
        if (!logSession) { return; }
        logSession.clear();
        this.statusBar.updateLineCount(0);
    }

    /** Stop all sessions (called on deactivate). */
    async stopAll(): Promise<void> {
        this.earlyBuffer.clear();
        this.childToParentId.clear();
        this.ownerSessionCreatedAt.clear();
        this.bufferingLoggedFor.clear();
        this.clearBufferTimeoutState();
        const unique = new Set<LogSession>(this.sessions.values());
        await Promise.allSettled([...unique].map(s => s.stop()));
        this.sessions.clear();
        this.ownerSessionIds.clear();
    }

    /** Get the keyword watcher instance (for external access to counts). */
    getWatcher(): KeywordWatcher { return this.watcher; }

    /** Recreate the keyword watcher from current config. */
    refreshWatcher(): void { this.watcher = this.createWatcher(); }

    // --- Private: session lookup, line/split broadcast, watcher ---

    /** Returns the single owner session if exactly one exists and was created within windowMs. Used by fallback and race guard. */
    private getSingleRecentOwnerSession(windowMs: number): { sid: string; logSession: LogSession } | null {
        if (this.ownerSessionIds.size !== 1) { return null; }
        const now = Date.now();
        for (const sid of this.ownerSessionIds) {
            const createdAt = this.ownerSessionCreatedAt.get(sid);
            if (createdAt !== undefined && now - createdAt < windowMs) {
                const logSession = this.sessions.get(sid) ?? null;
                return logSession ? { sid, logSession } : null;
            }
        }
        return null;
    }

    /** Clear buffer-timeout tracking (call when a session is created or aliased so we don't carry stale state). */
    private clearBufferTimeoutState(): void {
        this.firstBufferTime.clear();
        this.bufferTimeoutWarnedFor.clear();
    }

    /** Returns the owner session id that was created most recently (for multi-session fallback routing). */
    private getMostRecentOwnerSessionId(): string | null {
        let newestId: string | null = null;
        let newestAt = 0;
        for (const sid of this.ownerSessionIds) {
            const at = this.ownerSessionCreatedAt.get(sid) ?? 0;
            if (at > newestAt && this.sessions.has(sid)) {
                newestAt = at;
                newestId = sid;
            }
        }
        return newestId;
    }

    private broadcastLine(data: Omit<LineData, 'watchHits'>): void {
        const hits = data.isMarker ? [] : this.watcher.testLine(data.text);
        const watchHits = hits.length > 0 ? hits.map((h) => h.label) : undefined;
        const lineData: LineData = { ...data, watchHits };
        for (const listener of this.lineListeners) { listener(lineData); }
        if (hits.some((h) => h.alert === 'flash' || h.alert === 'badge')) {
            this.statusBar.updateWatchCounts(this.watcher.getCounts());
        }
        if (!data.isMarker && this.autoTagger) { this.autoTagger.processLine(data.text); }
    }

    private broadcastSplit(newUri: vscode.Uri, totalParts: number): void {
        for (const listener of this.splitListeners) { listener(newUri, totalParts, totalParts); }
    }

    private createWatcher(): KeywordWatcher {
        const config = getConfig();
        const patterns = config.watchPatterns.map((p) => ({
            keyword: p.keyword,
            alert: p.alert ?? ('flash' as const),
        }));
        return new KeywordWatcher(patterns);
    }
}
