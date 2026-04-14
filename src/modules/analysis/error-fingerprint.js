"use strict";
/**
 * Error fingerprinting: normalize error lines and produce stable hashes.
 * Variations of the same error (different ports, timestamps, IDs) map
 * to the same fingerprint, enabling cross-session error grouping.
 * Called from session-lifecycle finalizeSession; results stored in SessionMetadata.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyCategory = exports.hashFingerprint = exports.normalizeLine = void 0;
exports.scanForFingerprints = scanForFingerprints;
const vscode = __importStar(require("vscode"));
const error_rate_alert_1 = require("../features/error-rate-alert");
const error_fingerprint_pure_1 = require("./error-fingerprint-pure");
Object.defineProperty(exports, "normalizeLine", { enumerable: true, get: function () { return error_fingerprint_pure_1.normalizeLine; } });
Object.defineProperty(exports, "hashFingerprint", { enumerable: true, get: function () { return error_fingerprint_pure_1.hashFingerprint; } });
Object.defineProperty(exports, "classifyCategory", { enumerable: true, get: function () { return error_fingerprint_pure_1.classifyCategory; } });
const maxScanLines = 5000;
const maxFingerprints = 30;
const maxExampleLength = 200;
/** Scan a log file and return error fingerprints grouped by hash. */
async function scanForFingerprints(fileUri) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');
    const scanLimit = Math.min(lines.length, maxScanLines);
    const groups = new Map();
    for (let i = 0; i < scanLimit; i++) {
        collectFingerprint(lines[i], groups);
    }
    return rankFingerprints(groups);
}
function collectFingerprint(line, groups) {
    const trimmed = line.trim();
    if (!trimmed || !(0, error_rate_alert_1.isErrorLine)(trimmed, 'stdout')) {
        return;
    }
    const normalized = (0, error_fingerprint_pure_1.normalizeLine)(trimmed);
    if (normalized.length < 5) {
        return;
    }
    const hash = (0, error_fingerprint_pure_1.hashFingerprint)(normalized);
    const existing = groups.get(hash);
    if (existing) {
        existing.c++;
    }
    else {
        groups.set(hash, { n: normalized, e: trimmed.slice(0, maxExampleLength), c: 1, cat: (0, error_fingerprint_pure_1.classifyCategory)(trimmed) });
    }
}
function rankFingerprints(groups) {
    return [...groups.entries()]
        .sort((a, b) => b[1].c - a[1].c)
        .slice(0, maxFingerprints)
        .map(([h, { n, e, c, cat }]) => ({ h, n, e, c, cat: cat === 'non-fatal' ? undefined : cat }));
}
//# sourceMappingURL=error-fingerprint.js.map