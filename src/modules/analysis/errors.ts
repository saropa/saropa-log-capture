/**
 * Central front-door for error types and classification.
 *
 * Re-exports from:
 * - level-classifier: severity (info/warning/error etc.), classifyLevel, isActionableLevel, isAnrLine
 * - error-fingerprint: CrashCategory, FingerprintEntry, classifyCategory, normalizeLine, hashFingerprint, scanForFingerprints
 * - error-rate-alert: isErrorLine, isWarningLine
 * - error-status-store: ErrorStatus type only (persistence API stays in error-status-store)
 *
 * Viewer-only transient/critical/bug classification lives in viewer-error-classification.ts (client JS).
 */

export {
    type SeverityLevel,
    classifyLevel,
    isActionableLevel,
    isAnrLine,
} from './level-classifier';

export {
    type CrashCategory,
    type FingerprintEntry,
    classifyCategory,
    normalizeLine,
    hashFingerprint,
    scanForFingerprints,
} from './error-fingerprint';

export { isErrorLine, isWarningLine } from '../features/error-rate-alert';

export type { ErrorStatus } from '../misc/error-status-store';
