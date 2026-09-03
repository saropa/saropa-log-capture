/**
 * Output event routing: resolve effective session id when output arrives
 * for an unknown session (single/multi-session fallback, buffering, timeout warning).
 * Extracted to keep session-manager.ts under the line limit.
 */

import * as vscode from 'vscode';
import type { LogSession } from '../capture/log-session';
import { workspaceFolderMatches } from '../capture/log-session-helpers';
import type { SaropaLogCaptureConfig } from '../config/config';

export interface RoutingState {
    readonly sessions: ReadonlyMap<string, LogSession>;
    readonly ownerSessionIds: ReadonlySet<string>;
    readonly ownerSessionCreatedAt: ReadonlyMap<string, number>;
    bufferingLoggedFor: Set<string>;
    bufferTimeoutWarnedFor: Set<string>;
    firstBufferTime: Map<string, number>;
    diagnosticWrittenLoggedFor: Set<string>;
    readonly config: SaropaLogCaptureConfig;
    readonly outputChannel: vscode.OutputChannel;
    onOutputBufferedWithNoSession?: (sessionId: string) => void;
    // Bug 034: takes the incoming debug session's workspace folder so it can exclude
    // owner sessions opened for a different folder from the "most recent" fallback.
    getMostRecentOwnerSessionId: (workspaceFolder: vscode.WorkspaceFolder | undefined) => string | null;
}

/**
 * Try routing to the sole owner session — only when its recorded workspace folder matches the
 * incoming debug session's folder. Split out of resolveEffectiveSessionId to keep that function's
 * branch count readable and to isolate the bug 034 folder check in one place.
 * Returns null (not a fallback session id) when there is no single owner or the folder mismatches,
 * so the caller falls through to the multi-owner / buffering logic instead of misrouting.
 */
function resolveSingleOwner(
    sessionId: string,
    state: RoutingState,
    workspaceFolder: vscode.WorkspaceFolder | undefined,
): string | null {
    if (state.ownerSessionIds.size !== 1) { return null; }
    const effectiveSessionId = state.ownerSessionIds.values().next().value as string;
    const ownerSession = state.sessions.get(effectiveSessionId);
    if (!ownerSession || !workspaceFolderMatches(ownerSession.sessionContext.workspaceFolder, workspaceFolder)) {
        return null;
    }
    if (state.config.diagnosticCapture) {
        state.outputChannel.appendLine(`Capture diagnostic: routing output to single active session (incoming sessionId=${sessionId})`);
    }
    return effectiveSessionId;
}

/**
 * Resolve the session id to which an output event should be routed.
 * Mutates bufferingLoggedFor, bufferTimeoutWarnedFor, firstBufferTime, diagnosticWrittenLoggedFor.
 * May call onOutputBufferedWithNoSession when output is buffered and no session exists.
 *
 * @param workspaceFolder The originating debug session's workspace folder, when known. Bug 034
 * fix: every fallback branch below must confirm the candidate LogSession's folder matches this
 * one before routing to it — otherwise, in a multi-root workspace, output from folder B can be
 * appended to folder A's log file purely because folder A's session is the only one (or the
 * newest one) at the moment the event arrives.
 */
export function resolveEffectiveSessionId(
    sessionId: string,
    state: RoutingState,
    workspaceFolder: vscode.WorkspaceFolder | undefined,
): string {
    if (state.sessions.has(sessionId)) {
        if (state.config.diagnosticCapture && !state.diagnosticWrittenLoggedFor.has(sessionId)) {
            state.diagnosticWrittenLoggedFor.add(sessionId);
            state.outputChannel.appendLine(`Capture diagnostic: output written to log sessionId=${sessionId}`);
        }
        return sessionId;
    }

    const singleOwnerMatch = resolveSingleOwner(sessionId, state, workspaceFolder);
    if (singleOwnerMatch) { return singleOwnerMatch; }

    if (state.ownerSessionIds.size >= 2) {
        const newestId = state.getMostRecentOwnerSessionId(workspaceFolder);
        if (newestId) {
            if (state.config.diagnosticCapture && !state.bufferingLoggedFor.has(sessionId)) {
                // Prev/Next stepper removed in v9.0.6; point at current affordances.
                state.outputChannel.appendLine(`Capture diagnostic: routing output to most recent session (incoming sessionId=${sessionId}). If the open log looks empty, press [ or ] in the viewer, or pick another log from the Logs panel.`);
            }
            return newestId;
        }
        if (state.config.diagnosticCapture && !state.bufferingLoggedFor.has(sessionId)) {
            state.outputChannel.appendLine(`Capture diagnostic: output buffered (no session yet) sessionId=${sessionId}`);
        }
        state.bufferingLoggedFor.add(sessionId);
        return sessionId;
    }

    const now = Date.now();
    if (!state.firstBufferTime.has(sessionId)) {
        state.firstBufferTime.set(sessionId, now);
    }
    const bufferingMs = now - (state.firstBufferTime.get(sessionId) ?? now);
    if (bufferingMs > 30_000 && !state.bufferTimeoutWarnedFor.has(sessionId)) {
        state.bufferTimeoutWarnedFor.add(sessionId);
        state.outputChannel.appendLine(`Saropa Log Capture: output has been buffered for sessionId=${sessionId} for over 30s with no log session — enable diagnosticCapture or check capture is enabled.`);
    }
    if (state.config.diagnosticCapture && !state.bufferingLoggedFor.has(sessionId)) {
        state.outputChannel.appendLine(`Capture diagnostic: output buffered (no session yet) sessionId=${sessionId}`);
    }
    state.bufferingLoggedFor.add(sessionId);
    state.onOutputBufferedWithNoSession?.(sessionId);
    return sessionId;
}
