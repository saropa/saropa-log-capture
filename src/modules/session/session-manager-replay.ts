/**
 * Early-buffer replay helpers for SessionManagerImpl.
 * Replays DAP output that was buffered before a log session existed (fixes empty logs when adapter sends output under a different session id).
 */

import type { DapOutputBody } from '../capture/tracker';
import type { EarlyOutputBuffer } from './session-event-bus';
import type { SaropaLogCaptureConfig } from '../config/config';

/** Replay buffered events for one session (called when that session's log is ready). */
export function replayEarlyBuffer(
    earlyBuffer: EarlyOutputBuffer,
    sessionId: string,
    onOutput: (sessionId: string, body: DapOutputBody) => void,
    outputChannel: { appendLine: (s: string) => void },
): void {
    const buffered = earlyBuffer.drain(sessionId);
    if (buffered.length === 0) { return; }
    outputChannel.appendLine(`Replaying ${buffered.length} early output event(s)`);
    for (const body of buffered) { onOutput(sessionId, body); }
}

/** Options for replaying all other sessions' early-buffered output into the current session. */
export interface ReplayAllOptions {
    earlyBuffer: EarlyOutputBuffer;
    sessionId: string;
    onOutput: (sessionId: string, body: DapOutputBody) => void;
    config: SaropaLogCaptureConfig;
    outputChannel: { appendLine: (s: string) => void };
}

/** Replay all other session ids' buffered output into this session so no early output is lost. */
export function replayAllOtherEarlyBuffers(opts: ReplayAllOptions): void {
    const { earlyBuffer, sessionId, onOutput, config, outputChannel } = opts;
    const rest = earlyBuffer.drainAll();
    for (const [sid, bodies] of rest) {
        if (sid === sessionId || bodies.length === 0) { continue; }
        if (config.diagnosticCapture) {
            outputChannel.appendLine(`Capture diagnostic: replaying ${bodies.length} early event(s) from sessionId=${sid} into log`);
        }
        for (const body of bodies) { onOutput(sessionId, body); }
    }
}
