/**
 * Drift Advisor "how much goes into Log Capture session" — pure helpers (no vscode import)
 * so Node/Mocha tests can run without the VS Code test host.
 */

/** Drift Advisor setting: depth of Log Capture integration (bridge + built-in align on this key). */
export const DRIFT_ADVISOR_CONFIG_SECTION = 'driftViewer';

/** Scoped to workspace folder so multi-root picks the session’s folder. */
export const DRIFT_ADVISOR_INCLUDE_IN_SESSION_KEY = 'integrations.includeInLogCaptureSession';

export type DriftAdvisorIncludeInLogCaptureSession = 'none' | 'header' | 'full';

/** Unknown or missing values default to full so older Drift builds behave as before. */
export function normalizeDriftIncludeInLogCaptureSession(raw: unknown): DriftAdvisorIncludeInLogCaptureSession {
    if (raw === 'none' || raw === 'header' || raw === 'full') {
        return raw;
    }
    return 'full';
}

/** Built-in provider only writes meta/sidecar when Drift requests full session payload. */
export function driftBuiltinContributesMetaSidecar(level: DriftAdvisorIncludeInLogCaptureSession): boolean {
    return level === 'full';
}
