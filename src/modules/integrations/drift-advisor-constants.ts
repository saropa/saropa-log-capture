/**
 * Shared constants for optional Drift Advisor integration (viewer + built-in provider).
 * Command ID must match Drift Advisor's package.json contributes.commands when defined.
 *
 * Include-level helpers (normalize, config keys) live in `drift-advisor-include-level.ts` for testability.
 */

export const DRIFT_ADVISOR_EXTENSION_ID = 'saropa.drift-viewer';

export const DRIFT_ADVISOR_OPEN_COMMAND = 'saropa.drift-viewer.openWatchPanel';

/** Workspace path segments for session snapshot file (Phase 6 file contract). */
export const DRIFT_ADVISOR_SESSION_FILE_SEGMENTS = ['.saropa', 'drift-advisor-session.json'] as const;

/** Session meta key and sidecar naming (must match Drift Advisor bridge). */
export const DRIFT_ADVISOR_META_KEY = 'saropa-drift-advisor';

/** Bounded wait for extension `getSessionSnapshot()` during session end. */
export const DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS = 5000;
