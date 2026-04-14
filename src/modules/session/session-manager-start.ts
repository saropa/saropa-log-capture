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
import type { EarlyOutputBuffer } from './session-event-bus';

export type StartSessionDeps = {
    config: SaropaLogCaptureConfig;
    sessions: Map<string, LogSession>;
    ownerSessionIds: Set<string>;
    ownerSessionCreatedAt: Map<string, number>;
    childToParentId: Map<string, string>;
    earlyBuffer: EarlyOutputBuffer;
    outputChannel: vscode.OutputChannel;
    getSingleRecentOwnerSession: (windowMs: number) => { sid: string; logSession: LogSession } | null;
    statusBar: { updateLineCount: (n: number) => void; show: () => void };
    broadcastSplit: (newUri: vscode.Uri, totalParts: number) => void;
    onOutputEvent: (sessionId: string, body: DapOutputBody) => void;
    clearBufferTimeoutState: () => void;
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

    const recentChild = !session.parentSession ? deps.getSingleRecentOwnerSession(30_000) : null;
    if (recentChild) {
        deps.sessions.set(session.id, recentChild.logSession);
        deps.outputChannel.appendLine(`Parent session aliased to recent child (fallback): ${session.type}`);
        replayEarlyBuffer(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }

    const recentRace = deps.getSingleRecentOwnerSession(5000);
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
        onLineCount: (count) => deps.statusBar.updateLineCount(count),
        onSplit: (newUri, partNumber) => {
            deps.broadcastSplit(newUri, partNumber + 1);
            deps.outputChannel.appendLine(`File split: Part ${partNumber + 1} at ${newUri.fsPath}`);
        },
    } as InitSessionParams);

    if (!result) {
        deps.outputChannel.appendLine(`Session initialization failed: no log session created (type=${session.type} id=${session.id})`);
        return { kind: 'skipped' };
    }
    return { kind: 'created', result };
}
