"use strict";
/**
 * Early-buffer replay helpers for SessionManagerImpl.
 * Replays DAP output that was buffered before a log session existed (fixes empty logs when adapter sends output under a different session id).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayEarlyBuffer = replayEarlyBuffer;
exports.replayAllOtherEarlyBuffers = replayAllOtherEarlyBuffers;
/** Replay buffered events for one session (called when that session's log is ready). */
function replayEarlyBuffer(earlyBuffer, sessionId, onOutput, outputChannel) {
    const buffered = earlyBuffer.drain(sessionId);
    if (buffered.length === 0) {
        return;
    }
    outputChannel.appendLine(`Replaying ${buffered.length} early output event(s)`);
    for (const body of buffered) {
        onOutput(sessionId, body);
    }
}
/** Replay all other session ids' buffered output into this session so no early output is lost. */
function replayAllOtherEarlyBuffers(opts) {
    const { earlyBuffer, sessionId, onOutput, config, outputChannel } = opts;
    const rest = earlyBuffer.drainAll();
    for (const [sid, bodies] of rest) {
        if (sid === sessionId || bodies.length === 0) {
            continue;
        }
        if (config.diagnosticCapture) {
            outputChannel.appendLine(`Capture diagnostic: replaying ${bodies.length} early event(s) from sessionId=${sid} into log`);
        }
        for (const body of bodies) {
            onOutput(sessionId, body);
        }
    }
}
//# sourceMappingURL=session-manager-replay.js.map