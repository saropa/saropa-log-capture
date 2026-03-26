"use strict";
/**
 * In-memory store of detected correlations per session.
 * Key: session URI string. Persistence can be added later via session metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorrelations = getCorrelations;
exports.setCorrelations = setCorrelations;
exports.getLastSessionUri = getLastSessionUri;
exports.clearCorrelations = clearCorrelations;
exports.getCorrelationByLocation = getCorrelationByLocation;
exports.getCorrelationIdForEvent = getCorrelationIdForEvent;
const store = new Map();
let lastSessionUri;
function getCorrelations(sessionUri) {
    return store.get(sessionUri) ?? [];
}
function setCorrelations(sessionUri, correlations) {
    store.set(sessionUri, correlations);
    lastSessionUri = sessionUri;
}
function getLastSessionUri() {
    return lastSessionUri;
}
function clearCorrelations(sessionUri) {
    store.delete(sessionUri);
}
/** Build a map of (file URI + line number) -> correlation id and description for viewer. */
function getCorrelationByLocation(sessionUri) {
    const map = new Map();
    for (const c of getCorrelations(sessionUri)) {
        for (const e of c.events) {
            const key = e.location.line !== undefined
                ? `${e.location.file}:${e.location.line}`
                : e.location.file;
            map.set(key, { id: c.id, description: c.description });
        }
    }
    return map;
}
/** Build a map of event key (file:line or file) -> correlation id for timeline event rows. */
function getCorrelationIdForEvent(sessionUri) {
    const byLoc = getCorrelationByLocation(sessionUri);
    return (file, line) => {
        const key = line !== undefined ? `${file}:${line}` : file;
        return byLoc.get(key)?.id;
    };
}
//# sourceMappingURL=correlation-store.js.map