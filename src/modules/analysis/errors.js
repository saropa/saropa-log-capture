"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWarningLine = exports.isErrorLine = exports.scanForFingerprints = exports.hashFingerprint = exports.normalizeLine = exports.classifyCategory = exports.isAnrLine = exports.isActionableLevel = exports.classifyLevel = void 0;
var level_classifier_1 = require("./level-classifier");
Object.defineProperty(exports, "classifyLevel", { enumerable: true, get: function () { return level_classifier_1.classifyLevel; } });
Object.defineProperty(exports, "isActionableLevel", { enumerable: true, get: function () { return level_classifier_1.isActionableLevel; } });
Object.defineProperty(exports, "isAnrLine", { enumerable: true, get: function () { return level_classifier_1.isAnrLine; } });
var error_fingerprint_1 = require("./error-fingerprint");
Object.defineProperty(exports, "classifyCategory", { enumerable: true, get: function () { return error_fingerprint_1.classifyCategory; } });
Object.defineProperty(exports, "normalizeLine", { enumerable: true, get: function () { return error_fingerprint_1.normalizeLine; } });
Object.defineProperty(exports, "hashFingerprint", { enumerable: true, get: function () { return error_fingerprint_1.hashFingerprint; } });
Object.defineProperty(exports, "scanForFingerprints", { enumerable: true, get: function () { return error_fingerprint_1.scanForFingerprints; } });
var error_rate_alert_1 = require("../features/error-rate-alert");
Object.defineProperty(exports, "isErrorLine", { enumerable: true, get: function () { return error_rate_alert_1.isErrorLine; } });
Object.defineProperty(exports, "isWarningLine", { enumerable: true, get: function () { return error_rate_alert_1.isWarningLine; } });
//# sourceMappingURL=errors.js.map