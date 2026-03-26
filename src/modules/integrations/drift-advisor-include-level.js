"use strict";
/**
 * Drift Advisor "how much goes into Log Capture session" — pure helpers (no vscode import)
 * so Node/Mocha tests can run without the VS Code test host.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY = exports.DRIFT_ADVISOR_CONFIG_SECTION = void 0;
exports.normalizeDriftIncludeInLogCaptureSession = normalizeDriftIncludeInLogCaptureSession;
exports.driftBuiltinContributesMetaSidecar = driftBuiltinContributesMetaSidecar;
/** Drift Advisor setting: depth of Log Capture integration (bridge + built-in align on this key). */
exports.DRIFT_ADVISOR_CONFIG_SECTION = 'driftViewer';
/** Scoped to workspace folder so multi-root picks the session’s folder. */
exports.DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY = 'integrations.includeInLogCaptureSession';
/** Unknown or missing values default to full so older Drift builds behave as before. */
function normalizeDriftIncludeInLogCaptureSession(raw) {
    if (raw === 'none' || raw === 'header' || raw === 'full') {
        return raw;
    }
    return 'full';
}
/** Built-in provider only writes meta/sidecar when Drift requests full session payload. */
function driftBuiltinContributesMetaSidecar(level) {
    return level === 'full';
}
//# sourceMappingURL=drift-advisor-include-level.js.map