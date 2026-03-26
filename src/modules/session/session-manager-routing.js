"use strict";
/**
 * Output event routing: resolve effective session id when output arrives
 * for an unknown session (single/multi-session fallback, buffering, timeout warning).
 * Extracted to keep session-manager.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveSessionId = resolveEffectiveSessionId;
/**
 * Resolve the session id to which an output event should be routed.
 * Mutates bufferingLoggedFor, bufferTimeoutWarnedFor, firstBufferTime, diagnosticWrittenLoggedFor.
 * May call onOutputBufferedWithNoSession when output is buffered and no session exists.
 */
function resolveEffectiveSessionId(sessionId, state) {
    if (state.sessions.has(sessionId)) {
        if (state.config.diagnosticCapture && !state.diagnosticWrittenLoggedFor.has(sessionId)) {
            state.diagnosticWrittenLoggedFor.add(sessionId);
            state.outputChannel.appendLine(`Capture diagnostic: output written to log sessionId=${sessionId}`);
        }
        return sessionId;
    }
    if (state.ownerSessionIds.size === 1) {
        const effectiveSessionId = state.ownerSessionIds.values().next().value;
        if (state.config.diagnosticCapture) {
            state.outputChannel.appendLine(`Capture diagnostic: routing output to single active session (incoming sessionId=${sessionId})`);
        }
        return effectiveSessionId;
    }
    if (state.ownerSessionIds.size >= 2) {
        const newestId = state.getMostRecentOwnerSessionId();
        if (newestId) {
            if (state.config.diagnosticCapture && !state.bufferingLoggedFor.has(sessionId)) {
                state.outputChannel.appendLine(`Capture diagnostic: routing output to most recent session (incoming sessionId=${sessionId}). If the open log looks empty, use Prev/Next in the viewer to switch to the other log.`);
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
//# sourceMappingURL=session-manager-routing.js.map