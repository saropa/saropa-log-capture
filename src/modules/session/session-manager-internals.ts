/**
 * Pure helpers and broadcast logic for SessionManager (keeps session-manager.ts under line limit).
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';
import { LogSession } from '../capture/log-session';
import { KeywordWatcher } from '../features/keyword-watcher';
import { StatusBar } from '../../ui/shared/status-bar';
import { AutoTagger } from '../misc/auto-tagger';
import type { FloodGuard } from '../capture/flood-guard';
import type { SaropaLogCaptureConfig } from '../config/config';
import type { ExclusionRule } from '../features/exclusion-matcher';
import type { DapOutputBody } from '../capture/tracker';
import type { LineData, LineListener, SplitListener } from './session-event-bus';
import type { EarlyOutputBuffer } from './session-event-bus';
import type { SessionSetupResult } from './session-lifecycle-init';
import { replayEarlyBuffer, replayAllOtherEarlyBuffers } from './session-manager-replay';

/** Returns the single owner session if exactly one exists and was created within windowMs. */
export function getSingleRecentOwnerSession(
    ownerSessionIds: Set<string>,
    ownerSessionCreatedAt: Map<string, number>,
    sessions: Map<string, LogSession>,
    windowMs: number,
): { sid: string; logSession: LogSession } | null {
    if (ownerSessionIds.size !== 1) { return null; }
    const now = Date.now();
    for (const sid of ownerSessionIds) {
        const createdAt = ownerSessionCreatedAt.get(sid);
        if (createdAt !== undefined && now - createdAt < windowMs) {
            const logSession = sessions.get(sid) ?? null;
            return logSession ? { sid, logSession } : null;
        }
    }
    return null;
}

/** Clear buffer-timeout tracking (call when a session is created or aliased). */
export function clearBufferTimeoutState(
    firstBufferTime: Map<string, number>,
    bufferTimeoutWarnedFor: Set<string>,
): void {
    firstBufferTime.clear();
    bufferTimeoutWarnedFor.clear();
}

/** Returns the owner session id that was created most recently. */
export function getMostRecentOwnerSessionId(
    ownerSessionIds: Set<string>,
    ownerSessionCreatedAt: Map<string, number>,
    sessions: Map<string, LogSession>,
): string | null {
    let newestId: string | null = null;
    let newestAt = 0;
    for (const sid of ownerSessionIds) {
        const at = ownerSessionCreatedAt.get(sid) ?? 0;
        if (at > newestAt && sessions.has(sid)) {
            newestAt = at;
            newestId = sid;
        }
    }
    return newestId;
}

export function createWatcher(): KeywordWatcher {
    const config = getConfig();
    const patterns = config.watchPatterns.map((p) => ({
        keyword: p.keyword,
        alert: p.alert ?? ('flash' as const),
    }));
    return new KeywordWatcher(patterns);
}

export interface BroadcastLineDeps {
    watcher: KeywordWatcher;
    lineListeners: LineListener[];
    statusBar: StatusBar;
    autoTagger: AutoTagger | null;
}

export function broadcastLine(
    data: Omit<LineData, 'watchHits'>,
    deps: BroadcastLineDeps,
): void {
    const hits = data.isMarker ? [] : deps.watcher.testLine(data.text);
    const watchHits = hits.length > 0 ? hits.map((h) => h.label) : undefined;
    const lineData: LineData = { ...data, watchHits };
    for (const listener of deps.lineListeners) { listener(lineData); }
    if (hits.some((h) => h.alert === 'flash' || h.alert === 'badge')) {
        deps.statusBar.updateWatchCounts(deps.watcher.getCounts());
    }
    if (!data.isMarker && deps.autoTagger) { deps.autoTagger.processLine(data.text); }
}

export function broadcastSplit(
    newUri: vscode.Uri,
    totalParts: number,
    splitListeners: SplitListener[],
): void {
    for (const listener of splitListeners) { listener(newUri, totalParts, totalParts); }
}

/** State passed from SessionManagerImpl to apply start-session result (reduces session-manager.ts line count). */
export interface ApplyStartResultState {
    sessions: Map<string, LogSession>;
    ownerSessionIds: Set<string>;
    ownerSessionCreatedAt: Map<string, number>;
    childToParentId: Map<string, string>;
    earlyBuffer: EarlyOutputBuffer;
    outputChannel: vscode.OutputChannel;
    config: SaropaLogCaptureConfig;
    onOutputEvent: (sessionId: string, body: DapOutputBody) => void;
    clearBufferTimeoutState: () => void;
    statusBar: { show: () => void };
    setExclusionRules: (r: ExclusionRule[]) => void;
    setAutoTagger: (a: AutoTagger | null) => void;
    floodGuard: FloodGuard;
    categoryCounts: Record<string, number>;
    setSessionStartTime: (v: number) => void;
    setFloodSuppressedTotal: (v: number) => void;
}

/** Apply a created session result to manager state and replay early buffer. */
export function applyStartResult(
    state: ApplyStartResultState,
    session: vscode.DebugSession,
    result: SessionSetupResult,
): void {
    if (state.config.diagnosticCapture) {
        state.outputChannel.appendLine(`Capture diagnostic: new log session created sessionId=${session.id} type=${session.type}`);
    }
    state.sessions.set(session.id, result.logSession);
    state.ownerSessionIds.add(session.id);
    state.ownerSessionCreatedAt.set(session.id, Date.now());
    if (session.parentSession) { state.childToParentId.set(session.id, session.parentSession.id); }
    state.setExclusionRules(result.exclusionRules);
    state.setAutoTagger(result.autoTagger);
    state.floodGuard.reset();
    Object.keys(state.categoryCounts).forEach((k) => delete state.categoryCounts[k]);
    state.setSessionStartTime(Date.now());
    state.setFloodSuppressedTotal(0);
    state.statusBar.show();
    replayEarlyBuffer(state.earlyBuffer, session.id, state.onOutputEvent, state.outputChannel);
    replayAllOtherEarlyBuffers({
        earlyBuffer: state.earlyBuffer,
        sessionId: session.id,
        onOutput: state.onOutputEvent,
        config: state.config,
        outputChannel: state.outputChannel,
    });
    state.clearBufferTimeoutState();
}

// Per-workspace async lock that serializes concurrent startSession calls.
//
// Why this exists: when a launch produces two debug sessions that fire
// `onDidStartDebugSession` at nearly the same instant (e.g. Flutter's parent
// + its Dart VM child, or a compound launch), both handlers can reach the
// fall-through in `startSessionImpl` before the first handler's
// `applyStartResult` has published its state to `sessions` / `ownerSessionIds`.
// Both then call `initializeSession` and create separate `LogSession`
// instances. Because `generateBaseFileName` uses per-second timestamp
// granularity, same-second starts collide on a single filename; both writers
// append to the same file, both become owners, and both fire a "Log Captured"
// notification at termination — with identical paths but different per-session
// line counts. Serializing start ensures the second handler sees the first
// handler's `applyStartResult` and takes the alias branch instead.
const startLocks = new Map<string, Promise<void>>();

/**
 * Serialize concurrent start sequences for a given workspace key. The caller's
 * `run` is invoked only after any prior start for the same key has completed,
 * so aliasing checks inside `run` see the previous session's published state.
 */
export async function withStartLock<T>(
    key: string,
    run: () => Promise<T>,
): Promise<T> {
    const prior = startLocks.get(key);
    const started = (async () => {
        // Prior failures should not block the next start — swallow and continue.
        if (prior) { await prior.catch(() => { /* ignore */ }); }
        return run();
    })();
    // Track completion as Promise<void> so future callers can await regardless
    // of the result type and without observing our value or errors.
    const tracker = started.then(() => { /* ok */ }, () => { /* swallow */ });
    startLocks.set(key, tracker);
    try {
        return await started;
    } finally {
        // Only clear when we still own the slot — a chained call may have replaced it.
        if (startLocks.get(key) === tracker) { startLocks.delete(key); }
    }
}

/** Test-only: clear all in-flight start locks. */
export function _resetStartLocksForTests(): void {
    startLocks.clear();
}
