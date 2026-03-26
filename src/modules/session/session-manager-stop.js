"use strict";
/**
 * Session stop logic: cleanup maps, build stats, finalizeSession.
 * Extracted to keep session-manager.ts under the line limit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStopSessionDeps = buildStopSessionDeps;
exports.stopSessionImpl = stopSessionImpl;
const config_1 = require("../config/config");
const session_lifecycle_finalize_1 = require("./session-lifecycle-finalize");
/** Build StopSessionDeps from a manager that has the same shape. */
function buildStopSessionDeps(manager) {
    return manager;
}
/**
 * Stop a debug session: cleanup state, build stats, and finalize the log session.
 */
async function stopSessionImpl(session, deps) {
    deps.earlyBuffer.delete(session.id);
    deps.childToParentId.delete(session.id);
    deps.ownerSessionCreatedAt.delete(session.id);
    deps.bufferingLoggedFor.delete(session.id);
    deps.diagnosticWrittenLoggedFor.delete(session.id);
    deps.firstBufferTime.delete(session.id);
    deps.bufferTimeoutWarnedFor.delete(session.id);
    const logSession = deps.sessions.get(session.id);
    if (!logSession) {
        return;
    }
    deps.sessions.delete(session.id);
    const debugProcessId = deps.processIds.get(session.id);
    deps.processIds.delete(session.id);
    if (!deps.ownerSessionIds.has(session.id)) {
        return;
    }
    deps.ownerSessionIds.delete(session.id);
    const stats = (0, session_lifecycle_finalize_1.buildSessionStats)({
        logSession,
        sessionStartTime: deps.sessionStartTime,
        categoryCounts: deps.categoryCounts,
        watcher: deps.watcher,
        floodSuppressedTotal: deps.floodSuppressedTotal,
    });
    const onReportsIndexReady = deps.projectIndexer && (0, config_1.getConfig)().projectIndex.enabled
        ? (logUri) => {
            deps.metadataStore.loadMetadata(logUri).then((meta) => {
                deps.projectIndexer.upsertReportEntryFromMeta(logUri, meta).catch(() => { });
            }).catch(() => { });
        }
        : undefined;
    await (0, session_lifecycle_finalize_1.finalizeSession)({
        logSession,
        outputChannel: deps.outputChannel,
        autoTagger: deps.autoTagger,
        metadataStore: deps.metadataStore,
        debugAdapterType: session.type,
        sessionStartTime: deps.sessionStartTime,
        debugProcessId,
        onReportsIndexReady,
    }, stats);
    if (deps.ownerSessionIds.size === 0) {
        deps.statusBar.hide();
    }
}
//# sourceMappingURL=session-manager-stop.js.map