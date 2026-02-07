import * as vscode from 'vscode';
import { getConfig } from './config';
import { SessionManager, DapOutputBody } from './tracker';
import { LogSession } from './log-session';
import { SourceLocation } from './log-session-helpers';
import { StatusBar } from '../ui/status-bar';
import { KeywordWatcher } from './keyword-watcher';
import { FloodGuard } from './flood-guard';
import { ExclusionRule, testExclusion } from './exclusion-matcher';
import { AutoTagger } from './auto-tagger';
import { DapMessage, DapDirection, formatDapMessage } from './dap-formatter';
import { SessionMetadataStore } from './session-metadata';
import {
    initializeSession, finalizeSession, buildSessionStats,
} from './session-lifecycle';

const MAX_EARLY_BUFFER = 500;

/** Data object passed to line listeners for each log line. */
export interface LineData {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: Date;
    readonly sourcePath?: string;
    readonly sourceLine?: number;
    readonly watchHits?: string[];
}

/** Callback for lines written to the log file (used by the viewer). */
export type LineListener = (data: LineData) => void;

/** Callback for split events (used to update viewer breadcrumb). */
export type SplitListener = (newUri: vscode.Uri, partNumber: number, totalParts: number) => void;

/**
 * Manages active debug log sessions, bridges DAP output to LogSession,
 * and broadcasts written lines to registered listeners (e.g. sidebar viewer).
 */
export class SessionManagerImpl implements SessionManager {
    private readonly sessions = new Map<string, LogSession>();
    private readonly ownerSessionIds = new Set<string>();
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
    private readonly earlyOutputBuffer = new Map<string, DapOutputBody[]>();

    constructor(
        private readonly statusBar: StatusBar,
        private readonly outputChannel: vscode.OutputChannel,
    ) {
        this.watcher = this.createWatcher();
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
        const session = this.sessions.get(sessionId);
        // Buffer events arriving before async session init completes (race condition fix)
        if (!session) { this.bufferEarlyEvent(sessionId, body); return; }
        const config = getConfig();
        if (!config.enabled) { return; }

        const category = body.category ?? 'console';
        const text = body.output.replace(/\r?\n$/, '');
        if (text.length === 0) { return; }

        if (!config.captureAll && !config.categories.includes(category)) { return; }
        if (testExclusion(text, this.exclusionRules)) { return; }

        const floodResult = this.floodGuard.check(text);
        if (!floodResult.allow) { return; }
        const now = new Date();

        if (floodResult.suppressedCount) {
            this.floodSuppressedTotal += floodResult.suppressedCount;
            const summary = `[FLOOD SUPPRESSED: ${floodResult.suppressedCount} identical messages]`;
            session.appendLine(summary, 'system', now);
            this.broadcastLine({
                text: summary, isMarker: false, lineCount: session.lineCount,
                category: 'system', timestamp: now,
            });
        }

        const sourceLocation: SourceLocation | undefined =
            body.source?.path ? { path: body.source.path, line: body.line, column: body.column } : undefined;
        session.appendLine(text, category, now, sourceLocation);
        this.categoryCounts[category] = (this.categoryCounts[category] ?? 0) + 1;
        this.broadcastLine({
            text, isMarker: false, lineCount: session.lineCount,
            category, timestamp: now,
            sourcePath: body.source?.path, sourceLine: body.line,
        });
    }

    /** Called by the DAP tracker for all protocol messages (verbose mode). */
    onDapMessage(sessionId: string, msg: unknown, direction: DapDirection): void {
        if (!getConfig().verboseDap) { return; }
        const session = this.sessions.get(sessionId);
        if (!session) { return; }

        session.appendDapLine(formatDapMessage(msg as DapMessage, direction, new Date()));
    }

    /** Start capturing a debug session. */
    async startSession(
        session: vscode.DebugSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        if (!getConfig().enabled) { return; }
        if (session.parentSession && this.sessions.has(session.parentSession.id)) {
            this.sessions.set(session.id, this.sessions.get(session.parentSession.id)!);
            this.outputChannel.appendLine(`Child session aliased to parent: ${session.type}`);
            this.replayEarlyEvents(session.id);
            return;
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
        this.sessions.set(session.id, result.logSession);
        this.ownerSessionIds.add(session.id);
        this.exclusionRules = result.exclusionRules;
        this.autoTagger = result.autoTagger;
        this.floodGuard.reset();
        this.categoryCounts = {};
        this.sessionStartTime = Date.now();
        this.floodSuppressedTotal = 0;
        this.statusBar.show();
        this.replayEarlyEvents(session.id);
    }

    /** Stop and finalize a debug session's log file. */
    async stopSession(session: vscode.DebugSession): Promise<void> {
        this.earlyOutputBuffer.delete(session.id);
        const logSession = this.sessions.get(session.id);
        if (!logSession) { return; }
        this.sessions.delete(session.id);
        if (!this.ownerSessionIds.has(session.id)) { return; }
        this.ownerSessionIds.delete(session.id);

        const stats = buildSessionStats({
            logSession, sessionStartTime: this.sessionStartTime,
            categoryCounts: this.categoryCounts,
            watcher: this.watcher, floodSuppressedTotal: this.floodSuppressedTotal,
        });
        await finalizeSession({
            logSession, outputChannel: this.outputChannel,
            autoTagger: this.autoTagger, metadataStore: this.metadataStore,
        }, stats);

        if (this.ownerSessionIds.size === 0) { this.statusBar.hide(); }
    }

    /** Get the active LogSession for the current debug session. */
    getActiveSession(): LogSession | undefined {
        const active = vscode.debug.activeDebugSession;
        return active ? this.sessions.get(active.id) : undefined;
    }

    /** Get the log filename for the active session (basename only). */
    getActiveFilename(): string | undefined {
        return this.getActiveSession()?.fileUri.fsPath.split(/[\\/]/).pop();
    }

    /** Check if a debug session already has an active log session. */
    hasSession(sessionId: string): boolean { return this.sessions.has(sessionId); }

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
        this.earlyOutputBuffer.clear();
        const stopped = new Set<LogSession>();
        for (const [, session] of this.sessions) {
            if (!stopped.has(session)) {
                stopped.add(session);
                await session.stop().catch(() => {});
            }
        }
        this.sessions.clear();
        this.ownerSessionIds.clear();
    }

    /** Get the keyword watcher instance (for external access to counts). */
    getWatcher(): KeywordWatcher { return this.watcher; }

    /** Recreate the keyword watcher from current config. */
    refreshWatcher(): void { this.watcher = this.createWatcher(); }

    private bufferEarlyEvent(sessionId: string, body: DapOutputBody): void {
        let buf = this.earlyOutputBuffer.get(sessionId);
        if (!buf) { buf = []; this.earlyOutputBuffer.set(sessionId, buf); }
        if (buf.length < MAX_EARLY_BUFFER) { buf.push(body); }
    }

    private replayEarlyEvents(sessionId: string): void {
        const buffered = this.earlyOutputBuffer.get(sessionId);
        this.earlyOutputBuffer.delete(sessionId);
        if (!buffered || buffered.length === 0) { return; }
        this.outputChannel.appendLine(`Replaying ${buffered.length} early output event(s)`);
        for (const body of buffered) { this.onOutputEvent(sessionId, body); }
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
