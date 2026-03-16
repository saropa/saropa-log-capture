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
import { initializeSession } from './session-lifecycle-init';
import { finalizeSession, buildSessionStats } from './session-lifecycle-finalize';
import { LineData, LineListener, SplitListener, EarlyOutputBuffer } from './session-event-bus';
import { processOutputEvent, processApiWriteLine, processDapMessage } from './session-manager-events';
import { replayEarlyBuffer as replayEarlyBufferHelper, replayAllOtherEarlyBuffers as replayAllOtherEarlyBuffersHelper } from './session-manager-replay';
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
        let effectiveSessionId = sessionId;
        if (!this.sessions.has(sessionId)) {
            // Single-session fallback: route to the one open log so we don't drop output when the adapter uses a different session id.
            if (this.ownerSessionIds.size === 1) {
                effectiveSessionId = this.ownerSessionIds.values().next().value as string;
                if (this.cachedConfig.diagnosticCapture) {
                    this.outputChannel.appendLine(`Capture diagnostic: routing output to single active session (incoming sessionId=${sessionId})`);
                }
            } else {
                if (this.cachedConfig.diagnosticCapture && !this.bufferingLoggedFor.has(sessionId)) {
                    this.outputChannel.appendLine(`Capture diagnostic: output buffered (no session yet) sessionId=${sessionId}`);
                }
                this.bufferingLoggedFor.add(sessionId);
            }
        } else if (this.cachedConfig.diagnosticCapture && !this.diagnosticWrittenLoggedFor.has(sessionId)) {
            this.diagnosticWrittenLoggedFor.add(sessionId);
            this.outputChannel.appendLine(`Capture diagnostic: output written to log sessionId=${sessionId}`);
        }
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
        if (!this.cachedConfig.enabled) { return; }

        // Child debug sessions (e.g. Dart VM) share the parent's LogSession so output goes to one file.
        if (session.parentSession && this.sessions.has(session.parentSession.id)) {
            this.sessions.set(session.id, this.sessions.get(session.parentSession.id)!);
            this.outputChannel.appendLine(`Child session aliased to parent: ${session.type}`);
            replayEarlyBufferHelper(this.earlyBuffer, session.id, (id, b) => this.onOutputEvent(id, b), this.outputChannel);
            return;
        }
        // Parent started after child (e.g. Flutter after Dart VM): reuse the child's LogSession so one file gets all output.
        for (const [sid, logSession] of this.sessions) {
            if (this.childToParentId.get(sid) === session.id) {
                this.sessions.set(session.id, logSession);
                this.outputChannel.appendLine(`Parent session aliased to existing child: ${session.type}`);
                replayEarlyBufferHelper(this.earlyBuffer, session.id, (id, b) => this.onOutputEvent(id, b), this.outputChannel);
                return;
            }
        }
        // Fallback: child may have started first without parentSession set. If exactly one owner session was created in the last 15s, alias to it.
        if (!session.parentSession && this.ownerSessionIds.size >= 1) {
            const now = Date.now();
            const RECENT_MS = 15_000;
            let recentCount = 0;
            let candidateLogSession: LogSession | null = null;
            for (const sid of this.ownerSessionIds) {
                const createdAt = this.ownerSessionCreatedAt.get(sid);
                if (createdAt !== undefined && now - createdAt < RECENT_MS) {
                    recentCount++;
                    candidateLogSession = this.sessions.get(sid) ?? null;
                }
            }
            if (recentCount === 1 && candidateLogSession) {
                this.sessions.set(session.id, candidateLogSession);
                this.outputChannel.appendLine(`Parent session aliased to recent child (fallback): ${session.type}`);
                replayEarlyBufferHelper(this.earlyBuffer, session.id, (id, b) => this.onOutputEvent(id, b), this.outputChannel);
                return;
            }
        }
        const result = await initializeSession({
            session, context,
            outputChannel: this.outputChannel,
            onLineCount: (count) => this.statusBar.updateLineCount(count),
            onSplit: (newUri, partNumber) => {
                this.broadcastSplit(newUri, partNumber + 1);
                this.outputChannel.appendLine(`File split: Part ${partNumber + 1} at ${newUri.fsPath}`);
            },
        });
        if (!result) { return; }
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
        replayEarlyBufferHelper(this.earlyBuffer, session.id, (id, b) => this.onOutputEvent(id, b), this.outputChannel);
        replayAllOtherEarlyBuffersHelper({ earlyBuffer: this.earlyBuffer, sessionId: session.id, onOutput: (id, b) => this.onOutputEvent(id, b), config: this.cachedConfig, outputChannel: this.outputChannel });
    }

    /** Stop and finalize a debug session's log file. */
    async stopSession(session: vscode.DebugSession): Promise<void> {
        this.earlyBuffer.delete(session.id);
        this.childToParentId.delete(session.id);
        this.ownerSessionCreatedAt.delete(session.id);
        this.bufferingLoggedFor.delete(session.id);
        this.diagnosticWrittenLoggedFor.delete(session.id);
        const logSession = this.sessions.get(session.id);
        if (!logSession) { return; }
        this.sessions.delete(session.id);
        const debugProcessId = this.processIds.get(session.id);
        this.processIds.delete(session.id);
        if (!this.ownerSessionIds.has(session.id)) { return; }
        this.ownerSessionIds.delete(session.id);

        const stats = buildSessionStats({
            logSession, sessionStartTime: this.sessionStartTime,
            categoryCounts: this.categoryCounts,
            watcher: this.watcher, floodSuppressedTotal: this.floodSuppressedTotal,
        });
        const onReportsIndexReady = this.projectIndexer && getConfig().projectIndex.enabled
            ? (logUri: vscode.Uri) => {
                this.metadataStore.loadMetadata(logUri).then((meta) => {
                    this.projectIndexer!.upsertReportEntryFromMeta(logUri, meta).catch(() => {});
                }).catch(() => {});
            }
            : undefined;
        await finalizeSession({
            logSession, outputChannel: this.outputChannel,
            autoTagger: this.autoTagger, metadataStore: this.metadataStore,
            debugAdapterType: session.type,
            sessionStartTime: this.sessionStartTime,
            debugProcessId,
            onReportsIndexReady,
        }, stats);

        if (this.ownerSessionIds.size === 0) {
            this.statusBar.hide();
        }
    }

    /** Get the active LogSession for the current debug session. */
    getActiveSession(): LogSession | undefined {
        const active = vscode.debug.activeDebugSession;
        return active ? this.sessions.get(active.id) : undefined;
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
        const unique = new Set<LogSession>(this.sessions.values());
        await Promise.allSettled([...unique].map(s => s.stop()));
        this.sessions.clear();
        this.ownerSessionIds.clear();
    }

    /** Get the keyword watcher instance (for external access to counts). */
    getWatcher(): KeywordWatcher { return this.watcher; }

    /** Recreate the keyword watcher from current config. */
    refreshWatcher(): void { this.watcher = this.createWatcher(); }

    // --- Private: line/split broadcast, watcher ---

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
