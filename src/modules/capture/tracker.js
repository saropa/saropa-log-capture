"use strict";
/**
 * DAP protocol hook: routes debug adapter output events to SessionManager.
 * VS Code calls createDebugAdapterTracker per debug session; SaropaTracker forwards
 * output events to SessionManager.onOutputEvent and optional onDapMessage (verbose).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaropaTrackerFactory = void 0;
class SaropaTrackerFactory {
    sessionManager;
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }
    createDebugAdapterTracker(session) {
        return new SaropaTracker(session, this.sessionManager);
    }
}
exports.SaropaTrackerFactory = SaropaTrackerFactory;
class SaropaTracker {
    session;
    manager;
    constructor(session, manager) {
        this.session = session;
        this.manager = manager;
    }
    /** Intercept messages sent from VS Code to the debug adapter (outgoing). */
    onWillSendMessage(message) {
        this.manager.onDapMessage?.(this.session.id, message, 'outgoing');
    }
    /** Intercept messages received from the debug adapter (incoming). */
    onDidSendMessage(message) {
        const msg = message;
        if (msg.type === 'event' && msg.event === 'output' && msg.body && typeof msg.body.output === 'string') {
            this.manager.onOutputEvent(this.session.id, msg.body);
            return; // Output events handled by onOutputEvent — skip onDapMessage
        }
        if (msg.type === 'event' && msg.event === 'process' && msg.body && typeof msg.body.systemProcessId === 'number') {
            this.manager.onProcessId?.(this.session.id, msg.body.systemProcessId);
        }
        this.manager.onDapMessage?.(this.session.id, message, 'incoming');
    }
    onError(error) {
        console.error('[SaropaLogCapture] Tracker error:', error.message);
    }
}
//# sourceMappingURL=tracker.js.map