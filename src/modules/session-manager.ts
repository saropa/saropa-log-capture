import * as vscode from 'vscode';
import * as os from 'os';
import { getConfig, getLogDirectoryUri } from './config';
import { SessionManager, DapOutputBody } from './tracker';
import { LogSession, SessionContext } from './log-session';
import { enforceFileRetention } from './file-retention';
import { checkGitignore } from './gitignore-checker';
import { StatusBar } from '../ui/status-bar';
import { KeywordWatcher } from './keyword-watcher';

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

/**
 * Manages active debug log sessions, bridges DAP output to LogSession,
 * and broadcasts written lines to registered listeners (e.g. sidebar viewer).
 */
export class SessionManagerImpl implements SessionManager {
    private readonly sessions = new Map<string, LogSession>();
    private readonly ownerSessionIds = new Set<string>();
    private readonly lineListeners: LineListener[] = [];
    private watcher: KeywordWatcher;

    constructor(
        private readonly statusBar: StatusBar,
        private readonly outputChannel: vscode.OutputChannel,
    ) {
        this.watcher = this.createWatcher();
    }

    get activeSessionCount(): number {
        return this.ownerSessionIds.size;
    }

    /** Register a listener that receives every line written to the log. */
    addLineListener(listener: LineListener): void {
        this.lineListeners.push(listener);
    }

    /** Remove a previously registered line listener. */
    removeLineListener(listener: LineListener): void {
        const idx = this.lineListeners.indexOf(listener);
        if (idx >= 0) {
            this.lineListeners.splice(idx, 1);
        }
    }

    /** Called by the DAP tracker for every output event. */
    onOutputEvent(sessionId: string, body: DapOutputBody): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        const config = getConfig();
        if (!config.enabled) {
            return;
        }

        const category = body.category ?? 'console';
        if (!config.categories.includes(category)) {
            return;
        }

        const text = body.output.replace(/\r?\n$/, '');
        if (text.length === 0) {
            return;
        }

        const now = new Date();
        session.appendLine(text, category, now);
        this.broadcastLine({
            text, isMarker: false, lineCount: session.lineCount,
            category, timestamp: now, sourcePath: body.source?.path, sourceLine: body.line,
        });
    }

    /** Start capturing a debug session. */
    async startSession(
        session: vscode.DebugSession,
        context: vscode.ExtensionContext,
    ): Promise<void> {
        const config = getConfig();
        if (!config.enabled) {
            return;
        }

        if (session.parentSession && this.sessions.has(session.parentSession.id)) {
            this.sessions.set(session.id, this.sessions.get(session.parentSession.id)!);
            this.outputChannel.appendLine(`Child session aliased to parent: ${session.type}`);
            return;
        }

        const workspaceFolder = session.workspaceFolder ?? getWorkspaceFolder();
        if (!workspaceFolder) {
            this.outputChannel.appendLine('No workspace folder found. Skipping capture.');
            return;
        }

        checkGitignore(context, workspaceFolder, config.logDirectory).catch((err) => {
            this.outputChannel.appendLine(`Gitignore check failed: ${err}`);
        });

        const logDirUri = getLogDirectoryUri(workspaceFolder);
        enforceFileRetention(logDirUri, config.maxLogFiles).catch((err) => {
            this.outputChannel.appendLine(`File retention failed: ${err}`);
        });

        const sessionContext: SessionContext = {
            date: new Date(),
            projectName: workspaceFolder.name,
            debugAdapterType: session.type,
            configurationName: session.configuration.name,
            configuration: session.configuration,
            vscodeVersion: vscode.version,
            extensionVersion: context.extension.packageJSON.version ?? '0.0.0',
            os: `${os.type()} ${os.release()} (${os.arch()})`,
            workspaceFolder,
        };

        const logSession = new LogSession(sessionContext, config, (count) => {
            this.statusBar.updateLineCount(count);
        });

        try {
            await logSession.start();
            this.sessions.set(session.id, logSession);
            this.ownerSessionIds.add(session.id);
            this.statusBar.show();
            this.outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
        } catch (err) {
            this.outputChannel.appendLine(`Failed to start log session: ${err}`);
        }
    }

    /** Stop and finalize a debug session's log file. */
    async stopSession(session: vscode.DebugSession): Promise<void> {
        const logSession = this.sessions.get(session.id);
        if (!logSession) {
            return;
        }

        this.sessions.delete(session.id);

        // Child alias — just remove the mapping, don't close the log file.
        if (!this.ownerSessionIds.has(session.id)) {
            return;
        }
        this.ownerSessionIds.delete(session.id);

        try {
            await logSession.stop();
            this.outputChannel.appendLine(`Session stopped: ${logSession.fileUri.fsPath}`);
        } catch (err) {
            this.outputChannel.appendLine(`Error stopping log session: ${err}`);
        }

        if (this.ownerSessionIds.size === 0) {
            this.statusBar.hide();
        }

        const config = getConfig();
        if (config.autoOpen) {
            await vscode.window.showTextDocument(logSession.fileUri);
        }
    }

    /** Get the active LogSession for the current debug session. */
    getActiveSession(): LogSession | undefined {
        const active = vscode.debug.activeDebugSession;
        if (!active) {
            return undefined;
        }
        return this.sessions.get(active.id);
    }

    /** Get the log filename for the active session (basename only). */
    getActiveFilename(): string | undefined {
        const session = this.getActiveSession();
        if (!session) {
            return undefined;
        }
        return session.fileUri.fsPath.split(/[\\/]/).pop();
    }

    /** Check if a debug session already has an active log session. */
    hasSession(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    /** Insert a visual marker into the active log session. */
    insertMarker(customText?: string): void {
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
    togglePause(): boolean | undefined {
        const logSession = this.getActiveSession();
        if (!logSession) {
            return undefined;
        }
        if (logSession.state === 'recording') {
            logSession.pause();
            this.statusBar.setPaused(true);
            return true;
        } else if (logSession.state === 'paused') {
            logSession.resume();
            this.statusBar.setPaused(false);
            return false;
        }
        return undefined;
    }

    /** Clear the active session's line count and viewer. */
    clearActiveSession(): void {
        const logSession = this.getActiveSession();
        if (!logSession) {
            return;
        }
        logSession.clear();
        this.statusBar.updateLineCount(0);
    }

    /** Stop all sessions (called on deactivate). */
    async stopAll(): Promise<void> {
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
    getWatcher(): KeywordWatcher {
        return this.watcher;
    }

    /** Recreate the keyword watcher from current config. */
    refreshWatcher(): void {
        this.watcher = this.createWatcher();
    }

    private broadcastLine(data: Omit<LineData, 'watchHits'>): void {
        const hits = data.isMarker ? [] : this.watcher.testLine(data.text);
        const watchHits = hits.length > 0 ? hits.map(h => h.label) : undefined;
        const lineData: LineData = { ...data, watchHits };
        for (const listener of this.lineListeners) {
            listener(lineData);
        }
        if (hits.some(h => h.alert === 'flash' || h.alert === 'badge')) {
            this.statusBar.updateWatchCounts(this.watcher.getCounts());
        }
    }

    private createWatcher(): KeywordWatcher {
        const config = getConfig();
        const patterns = config.watchPatterns.map(p => ({
            keyword: p.keyword,
            alert: p.alert ?? 'flash' as const,
        }));
        return new KeywordWatcher(patterns);
    }
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}
