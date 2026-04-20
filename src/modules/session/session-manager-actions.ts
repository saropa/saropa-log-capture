/**
 * Active-session actions: toggle pause, clear, write, stop-all.
 * Extracted from session-manager.ts to keep that file under the 300-line limit.
 */

import type { LogSession } from '../capture/log-session';
import type { EarlyOutputBuffer } from './session-event-bus';

export interface TogglePauseDeps {
    readonly logSession: LogSession;
    setPaused(v: boolean): void;
}

/** Toggle pause/resume on the given log session. Returns the new paused state (or undefined). */
export function togglePauseOn(deps: TogglePauseDeps): boolean | undefined {
    const { logSession, setPaused } = deps;
    if (logSession.state === 'recording') {
        logSession.pause();
        setPaused(true);
        return true;
    }
    if (logSession.state === 'paused') {
        logSession.resume();
        setPaused(false);
        return false;
    }
    return undefined;
}

export interface StopAllDeps {
    readonly sessions: Map<string, LogSession>;
    readonly ownerSessionIds: Set<string>;
    readonly ownerSessionCreatedAt: Map<string, number>;
    readonly childToParentId: Map<string, string>;
    readonly bufferingLoggedFor: Set<string>;
    readonly earlyBuffer: EarlyOutputBuffer;
    clearBufferTimeoutState(): void;
}

/** Stop all sessions and clear all associated bookkeeping state. Called on deactivate. */
export async function stopAllSessions(deps: StopAllDeps): Promise<void> {
    deps.earlyBuffer.clear();
    deps.childToParentId.clear();
    deps.ownerSessionCreatedAt.clear();
    deps.bufferingLoggedFor.clear();
    deps.clearBufferTimeoutState();
    /* Dedupe: parent/child sessions share the same LogSession instance via aliasing. */
    const unique = new Set<LogSession>(deps.sessions.values());
    await Promise.allSettled([...unique].map(s => s.stop()));
    deps.sessions.clear();
    deps.ownerSessionIds.clear();
}
