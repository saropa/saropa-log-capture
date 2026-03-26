"use strict";
/**
 * Pure helpers and broadcast logic for SessionManager (keeps session-manager.ts under line limit).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSingleRecentOwnerSession = getSingleRecentOwnerSession;
exports.clearBufferTimeoutState = clearBufferTimeoutState;
exports.getMostRecentOwnerSessionId = getMostRecentOwnerSessionId;
exports.createWatcher = createWatcher;
exports.broadcastLine = broadcastLine;
exports.broadcastSplit = broadcastSplit;
exports.applyStartResult = applyStartResult;
const config_1 = require("../config/config");
const keyword_watcher_1 = require("../features/keyword-watcher");
const session_manager_replay_1 = require("./session-manager-replay");
/** Returns the single owner session if exactly one exists and was created within windowMs. */
function getSingleRecentOwnerSession(ownerSessionIds, ownerSessionCreatedAt, sessions, windowMs) {
    if (ownerSessionIds.size !== 1) {
        return null;
    }
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
function clearBufferTimeoutState(firstBufferTime, bufferTimeoutWarnedFor) {
    firstBufferTime.clear();
    bufferTimeoutWarnedFor.clear();
}
/** Returns the owner session id that was created most recently. */
function getMostRecentOwnerSessionId(ownerSessionIds, ownerSessionCreatedAt, sessions) {
    let newestId = null;
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
function createWatcher() {
    const config = (0, config_1.getConfig)();
    const patterns = config.watchPatterns.map((p) => ({
        keyword: p.keyword,
        alert: p.alert ?? 'flash',
    }));
    return new keyword_watcher_1.KeywordWatcher(patterns);
}
function broadcastLine(data, deps) {
    const hits = data.isMarker ? [] : deps.watcher.testLine(data.text);
    const watchHits = hits.length > 0 ? hits.map((h) => h.label) : undefined;
    const lineData = { ...data, watchHits };
    for (const listener of deps.lineListeners) {
        listener(lineData);
    }
    if (hits.some((h) => h.alert === 'flash' || h.alert === 'badge')) {
        deps.statusBar.updateWatchCounts(deps.watcher.getCounts());
    }
    if (!data.isMarker && deps.autoTagger) {
        deps.autoTagger.processLine(data.text);
    }
}
function broadcastSplit(newUri, totalParts, splitListeners) {
    for (const listener of splitListeners) {
        listener(newUri, totalParts, totalParts);
    }
}
/** Apply a created session result to manager state and replay early buffer. */
function applyStartResult(state, session, result) {
    if (state.config.diagnosticCapture) {
        state.outputChannel.appendLine(`Capture diagnostic: new log session created sessionId=${session.id} type=${session.type}`);
    }
    state.sessions.set(session.id, result.logSession);
    state.ownerSessionIds.add(session.id);
    state.ownerSessionCreatedAt.set(session.id, Date.now());
    if (session.parentSession) {
        state.childToParentId.set(session.id, session.parentSession.id);
    }
    state.setExclusionRules(result.exclusionRules);
    state.setAutoTagger(result.autoTagger);
    state.floodGuard.reset();
    Object.keys(state.categoryCounts).forEach((k) => delete state.categoryCounts[k]);
    state.setSessionStartTime(Date.now());
    state.setFloodSuppressedTotal(0);
    state.statusBar.show();
    (0, session_manager_replay_1.replayEarlyBuffer)(state.earlyBuffer, session.id, state.onOutputEvent, state.outputChannel);
    (0, session_manager_replay_1.replayAllOtherEarlyBuffers)({
        earlyBuffer: state.earlyBuffer,
        sessionId: session.id,
        onOutput: state.onOutputEvent,
        config: state.config,
        outputChannel: state.outputChannel,
    });
    state.clearBufferTimeoutState();
}
//# sourceMappingURL=session-manager-internals.js.map