/**
 * Session start logic: parent/child aliasing, race guard, and initializeSession.
 * Extracted to keep session-manager.ts under the line limit.
 */

import * as vscode from 'vscode';
import type { DapOutputBody } from '../capture/tracker';
import type { LogSession } from '../capture/log-session';
import type { SaropaLogCaptureConfig } from '../config/config';
import { initializeSession, type SessionSetupResult, type InitSessionParams } from './session-lifecycle-init';
import { replayEarlyBuffer, replayAllOtherEarlyBuffers } from './session-manager-replay';
import type { EarlyOutputBuffer, LineData } from './session-event-bus';

export type StartSessionDeps = {
    config: SaropaLogCaptureConfig;
    sessions: Map<string, LogSession>;
    ownerSessionIds: Set<string>;
    ownerSessionCreatedAt: Map<string, number>;
    childToParentId: Map<string, string>;
    earlyBuffer: EarlyOutputBuffer;
    outputChannel: vscode.OutputChannel;
    // Bug 034: workspaceFolder is threaded through so callers can refuse to alias a new
    // session onto an existing LogSession opened for a different workspace root.
    getSingleRecentOwnerSession: (
        windowMs: number,
        workspaceFolder?: vscode.WorkspaceFolder,
    ) => { sid: string; logSession: LogSession } | null;
    statusBar: { updateLineCount: (n: number) => void; show: () => void };
    broadcastSplit: (newUri: vscode.Uri, totalParts: number) => void;
    // Same broadcast used by the DAP output path — threaded through to initializeSession so
    // streaming integrations (adb logcat) can reach the live viewer too (bug_010).
    broadcastLine: (data: Omit<LineData, 'watchHits'>) => void;
    onOutputEvent: (sessionId: string, body: DapOutputBody) => void;
    clearBufferTimeoutState: () => void;
    // Authoritative active-session line count, reported from the write queue (write-time, not
    // enqueue-time), so the history tree's count can't lag the file by the queue depth (M1).
    onActiveLineCount?: (n: number) => void;
};

export type StartSessionOutcome =
    | { kind: 'aliased' }
    | { kind: 'skipped' }
    | { kind: 'created'; result: SessionSetupResult };

/**
 * Run start-session logic: alias parent/child or create new log session.
 * Caller must apply returned state (sessions.set, ownerSessionIds.add, etc.) when kind === 'created'.
 */
export async function startSessionImpl(
    session: vscode.DebugSession,
    context: vscode.ExtensionContext,
    deps: StartSessionDeps,
): Promise<StartSessionOutcome> {
    if (!deps.config.enabled) {
        deps.outputChannel.appendLine(`Session start skipped: saropaLogCapture.enabled is false (type=${session.type})`);
        return { kind: 'skipped' };
    }

    if (session.parentSession && deps.sessions.has(session.parentSession.id)) {
        deps.sessions.set(session.id, deps.sessions.get(session.parentSession.id)!);
        deps.outputChannel.appendLine(`Child session aliased to parent: ${session.type}`);
        replayEarlyBuffer(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }

    for (const [sid, logSession] of deps.sessions) {
        if (deps.childToParentId.get(sid) === session.id) {
            deps.sessions.set(session.id, logSession);
            deps.outputChannel.appendLine(`Parent session aliased to existing child: ${session.type}`);
            replayEarlyBuffer(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
            deps.clearBufferTimeoutState();
            return { kind: 'aliased' };
        }
    }

    // Bug 034: pass session.workspaceFolder so a folder-B session cannot alias onto a
    // folder-A LogSession just because A's session started within the last 30s.
    const recentChild = !session.parentSession
        ? deps.getSingleRecentOwnerSession(30_000, session.workspaceFolder)
        : null;
    if (recentChild) {
        deps.sessions.set(session.id, recentChild.logSession);
        deps.outputChannel.appendLine(`Parent session aliased to recent child (fallback): ${session.type}`);
        replayEarlyBuffer(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }

    // Bug 034: same folder guard on the tighter race-guard window — this is the path that
    // was aliasing a fresh folder-B session to folder-A's just-created LogSession with no
    // folder check at all, the core of the multi-root contamination bug.
    const recentRace = deps.getSingleRecentOwnerSession(5000, session.workspaceFolder);
    if (recentRace) {
        deps.sessions.set(session.id, recentRace.logSession);
        deps.outputChannel.appendLine(`Session aliased to just-created session (race guard): ${session.type}`);
        replayEarlyBuffer(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        replayAllOtherEarlyBuffers({
            earlyBuffer: deps.earlyBuffer,
            sessionId: session.id,
            onOutput: deps.onOutputEvent,
            config: deps.config,
            outputChannel: deps.outputChannel,
        });
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }

    const result = await initializeSession({
        session,
        context,
        outputChannel: deps.outputChannel,
        // One write-time callback drives both the status bar and the history-tree active count, so
        // neither reads the lagging enqueue-time session.lineCount (M1).
        onLineCount: (count) => { deps.statusBar.updateLineCount(count); deps.onActiveLineCount?.(count); },
        onSplit: (newUri, partNumber) => {
            deps.broadcastSplit(newUri, partNumber + 1);
            deps.outputChannel.appendLine(`File split: Part ${partNumber + 1} at ${newUri.fsPath}`);
        },
        broadcastLine: (data) => deps.broadcastLine(data),
    } as InitSessionParams);

    if (!result) {
        deps.outputChannel.appendLine(`Session initialization failed: no log session created (type=${session.type} id=${session.id})`);
        return { kind: 'skipped' };
    }
    return { kind: 'created', result };
}
