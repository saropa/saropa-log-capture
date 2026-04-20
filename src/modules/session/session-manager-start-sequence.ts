/**
 * Orchestration for the serialized start sequence.
 * Extracted from session-manager.ts to keep that file under the 300-line limit.
 */

import * as vscode from 'vscode';
import type { DapOutputBody } from '../capture/tracker';
import type { LogSession } from '../capture/log-session';
import type { SaropaLogCaptureConfig } from '../config/config';
import { getConfig } from '../config/config';
import type { EarlyOutputBuffer } from './session-event-bus';
import type { ExclusionRule } from '../features/exclusion-matcher';
import type { AutoTagger } from '../misc/auto-tagger';
import type { FloodGuard } from '../capture/flood-guard';
import { startSessionImpl, type StartSessionDeps } from './session-manager-start';
import { applyStartResult } from './session-manager-internals';

/**
 * Dependency bag passed in by the session manager. The orchestrator reads
 * live values via getters and writes new values via setters so field
 * mutations on the manager stay authoritative.
 */
export interface StartSequenceDeps {
    readonly sessions: Map<string, LogSession>;
    readonly ownerSessionIds: Set<string>;
    readonly ownerSessionCreatedAt: Map<string, number>;
    readonly childToParentId: Map<string, string>;
    readonly earlyBuffer: EarlyOutputBuffer;
    readonly outputChannel: vscode.OutputChannel;
    readonly statusBar: { updateLineCount: (n: number) => void; show: () => void };
    readonly floodGuard: FloodGuard;
    readonly categoryCounts: Record<string, number>;
    getSingleRecentOwnerSession(windowMs: number): { sid: string; logSession: LogSession } | null;
    broadcastSplit(newUri: vscode.Uri, totalParts: number): void;
    onOutputEvent(sessionId: string, body: DapOutputBody): void;
    clearBufferTimeoutState(): void;
    setExclusionRules(rules: ExclusionRule[]): void;
    setAutoTagger(tagger: AutoTagger | null): void;
    setSessionStartTime(v: number): void;
    setFloodSuppressedTotal(v: number): void;
}

/**
 * Run the aliasing-then-create sequence. Assumed to already be serialized by
 * caller (per-workspace start lock) so concurrent DAP onDidStartDebugSession
 * events cannot both fall through the aliasing checks.
 *
 * Returns the refreshed config snapshot — caller should assign it to its
 * cached config field so subsequent event handlers see the same values.
 */
export async function runStartSequenceImpl(
    deps: StartSequenceDeps,
    session: vscode.DebugSession,
    context: vscode.ExtensionContext,
): Promise<SaropaLogCaptureConfig> {
    const config = getConfig();
    const startDeps: StartSessionDeps = {
        config,
        sessions: deps.sessions,
        ownerSessionIds: deps.ownerSessionIds,
        ownerSessionCreatedAt: deps.ownerSessionCreatedAt,
        childToParentId: deps.childToParentId,
        earlyBuffer: deps.earlyBuffer,
        outputChannel: deps.outputChannel,
        getSingleRecentOwnerSession: (w) => deps.getSingleRecentOwnerSession(w),
        statusBar: deps.statusBar,
        broadcastSplit: (uri, totalParts) => deps.broadcastSplit(uri, totalParts),
        onOutputEvent: (id, b) => deps.onOutputEvent(id, b),
        clearBufferTimeoutState: () => deps.clearBufferTimeoutState(),
    };
    const outcome = await startSessionImpl(session, context, startDeps);
    /* startSessionImpl already logs the specific skip reason (disabled / init failed). */
    if (outcome.kind === 'skipped' || outcome.kind === 'aliased') { return config; }
    const onOut = (id: string, b: DapOutputBody): void => deps.onOutputEvent(id, b);
    applyStartResult({
        sessions: deps.sessions,
        ownerSessionIds: deps.ownerSessionIds,
        ownerSessionCreatedAt: deps.ownerSessionCreatedAt,
        childToParentId: deps.childToParentId,
        earlyBuffer: deps.earlyBuffer,
        outputChannel: deps.outputChannel,
        config,
        onOutputEvent: onOut,
        clearBufferTimeoutState: () => deps.clearBufferTimeoutState(),
        statusBar: deps.statusBar,
        setExclusionRules: (r) => deps.setExclusionRules(r),
        setAutoTagger: (a) => deps.setAutoTagger(a),
        floodGuard: deps.floodGuard,
        categoryCounts: deps.categoryCounts,
        setSessionStartTime: (v) => deps.setSessionStartTime(v),
        setFloodSuppressedTotal: (v) => deps.setFloodSuppressedTotal(v),
    }, session, outcome.result);
    return config;
}
