"use strict";
/**
 * Shared constants for optional Drift Advisor integration (viewer + built-in provider).
 * Command ID must match Drift Advisor's package.json contributes.commands when defined.
 *
 * Include-level helpers (normalize, config keys) live in `drift-advisor-include-level.ts` for testability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION = exports.DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS = exports.DRIFT_ADVISOR_META_KEY = exports.DRIFT_ADVISOR_SESSION_FILE_SEGMENTS = exports.DRIFT_ADVISOR_OPEN_COMMAND = exports.DRIFT_ADVISOR_EXTENSION_ID = void 0;
exports.DRIFT_ADVISOR_EXTENSION_ID = 'saropa.drift-viewer';
exports.DRIFT_ADVISOR_OPEN_COMMAND = 'saropa.drift-viewer.openWatchPanel';
/** Workspace path segments for session snapshot file (Phase 6 file contract). */
exports.DRIFT_ADVISOR_SESSION_FILE_SEGMENTS = ['.saropa', 'drift-advisor-session.json'];
/** Session meta key and sidecar naming (must match Drift Advisor bridge). */
exports.DRIFT_ADVISOR_META_KEY = 'saropa-drift-advisor';
/** Bounded wait for extension `getSessionSnapshot()` during session end. */
exports.DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS = 5000;
/**
 * Optional `schemaVersion` on meta and sidecar JSON when the snapshot omits it.
 * Increment when Log Capture’s emitted shape changes; Drift bridge may set its own version.
 */
exports.DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION = 1;
//# sourceMappingURL=drift-advisor-constants.js.map