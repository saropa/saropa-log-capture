"use strict";
/**
 * Session start logic: parent/child aliasing, race guard, and initializeSession.
 * Extracted to keep session-manager.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSessionImpl = startSessionImpl;
const session_lifecycle_init_1 = require("./session-lifecycle-init");
const session_manager_replay_1 = require("./session-manager-replay");
/**
 * Run start-session logic: alias parent/child or create new log session.
 * Caller must apply returned state (sessions.set, ownerSessionIds.add, etc.) when kind === 'created'.
 */
async function startSessionImpl(session, context, deps) {
    if (!deps.config.enabled) {
        return { kind: 'skipped' };
    }
    if (session.parentSession && deps.sessions.has(session.parentSession.id)) {
        deps.sessions.set(session.id, deps.sessions.get(session.parentSession.id));
        deps.outputChannel.appendLine(`Child session aliased to parent: ${session.type}`);
        (0, session_manager_replay_1.replayEarlyBuffer)(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }
    for (const [sid, logSession] of deps.sessions) {
        if (deps.childToParentId.get(sid) === session.id) {
            deps.sessions.set(session.id, logSession);
            deps.outputChannel.appendLine(`Parent session aliased to existing child: ${session.type}`);
            (0, session_manager_replay_1.replayEarlyBuffer)(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
            deps.clearBufferTimeoutState();
            return { kind: 'aliased' };
        }
    }
    const recentChild = !session.parentSession ? deps.getSingleRecentOwnerSession(30_000) : null;
    if (recentChild) {
        deps.sessions.set(session.id, recentChild.logSession);
        deps.outputChannel.appendLine(`Parent session aliased to recent child (fallback): ${session.type}`);
        (0, session_manager_replay_1.replayEarlyBuffer)(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }
    const recentRace = deps.getSingleRecentOwnerSession(5000);
    if (recentRace) {
        deps.sessions.set(session.id, recentRace.logSession);
        deps.outputChannel.appendLine(`Session aliased to just-created session (race guard): ${session.type}`);
        (0, session_manager_replay_1.replayEarlyBuffer)(deps.earlyBuffer, session.id, deps.onOutputEvent, deps.outputChannel);
        (0, session_manager_replay_1.replayAllOtherEarlyBuffers)({
            earlyBuffer: deps.earlyBuffer,
            sessionId: session.id,
            onOutput: deps.onOutputEvent,
            config: deps.config,
            outputChannel: deps.outputChannel,
        });
        deps.clearBufferTimeoutState();
        return { kind: 'aliased' };
    }
    const result = await (0, session_lifecycle_init_1.initializeSession)({
        session,
        context,
        outputChannel: deps.outputChannel,
        onLineCount: (count) => deps.statusBar.updateLineCount(count),
        onSplit: (newUri, partNumber) => {
            deps.broadcastSplit(newUri, partNumber + 1);
            deps.outputChannel.appendLine(`File split: Part ${partNumber + 1} at ${newUri.fsPath}`);
        },
    });
    if (!result) {
        return { kind: 'skipped' };
    }
    return { kind: 'created', result };
}
//# sourceMappingURL=session-manager-start.js.map