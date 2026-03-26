"use strict";
/**
 * Types and early-output buffer for session event dispatching.
 * LineData and LineListener/SplitListener are used by extension-activation to wire
 * SessionManager → ViewerBroadcaster and SessionHistoryProvider. EarlyOutputBuffer
 * exists because DAP can emit output before initializeSession() completes; events
 * are buffered and replayed after startSession().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarlyOutputBuffer = void 0;
const maxEarlyBuffer = 500;
/** Buffers DAP output events for a sessionId until startSession completes; then replayed by SessionManager. */
class EarlyOutputBuffer {
    buffer = new Map();
    /** Buffer an event for a session not yet initialized. */
    add(sessionId, body) {
        let buf = this.buffer.get(sessionId);
        if (!buf) {
            buf = [];
            this.buffer.set(sessionId, buf);
        }
        if (buf.length < maxEarlyBuffer) {
            buf.push(body);
        }
    }
    /** Drain and return all buffered events for a session. */
    drain(sessionId) {
        const buffered = this.buffer.get(sessionId);
        this.buffer.delete(sessionId);
        return buffered ?? [];
    }
    /** Drain and return all buffered events for every session (and clear the buffer). Use when creating the first log session so no early output is lost. */
    drainAll() {
        const out = new Map(this.buffer);
        this.buffer.clear();
        return out;
    }
    /** Remove buffered events for a session. */
    delete(sessionId) {
        this.buffer.delete(sessionId);
    }
    /** Clear all buffers. */
    clear() {
        this.buffer.clear();
    }
}
exports.EarlyOutputBuffer = EarlyOutputBuffer;
//# sourceMappingURL=session-event-bus.js.map