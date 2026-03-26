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
exports.scanForFingerprints = scanForFingerprints;
exports.normalizeLine = normalizeLine;
exports.hashFingerprint = hashFingerprint;
exports.classifyCategory = classifyCategory;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../capture/ansi");
const error_rate_alert_1 = require("../features/error-rate-alert");
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
/** Normalize a single line for fingerprinting. */
function normalizeLine(text) {
    let s = (0, ansi_1.stripAnsi)(text);
    s = s.replace(/^\[[\d:.,T\-Z ]+\]\s*/, '');
    s = s.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '<TS>');
    s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>');
    s = s.replace(/\b0x[0-9a-fA-F]{4,}\b/g, '<HEX>');
    s = s.replace(/\b\d{2,}\b/g, '<N>');
    s = s.replace(/(?:[a-zA-Z]:)?[\\/](?:[\w.\-]+[\\/])+/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}
/** FNV-1a 32-bit hash, returned as 8-char hex. */
function hashFingerprint(normalized) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
const anrRe = /ANR|Application Not Responding|Input dispatching timed out/i;
const oomRe = /OutOfMemoryError|heap exhaustion|\bOOM\b|Cannot allocate/i;
const nativeRe = /SIGSEGV|SIGABRT|SIGBUS|libflutter\.so|native crash/i;
const fatalRe = /\bFATAL\b|unhandled exception|uncaught/i;
/** Classify an error line into a crash category. */
function classifyCategory(text) {
    if (anrRe.test(text)) {
        return 'anr';
    }
    if (oomRe.test(text)) {
        return 'oom';
    }
    if (nativeRe.test(text)) {
        return 'native';
    }
    if (fatalRe.test(text)) {
        return 'fatal';
    }
    return 'non-fatal';
}
function collectFingerprint(line, groups) {
    const trimmed = line.trim();
    if (!trimmed || !(0, error_rate_alert_1.isErrorLine)(trimmed, 'stdout')) {
        return;
    }
    const normalized = normalizeLine(trimmed);
    if (normalized.length < 5) {
        return;
    }
    const hash = hashFingerprint(normalized);
    const existing = groups.get(hash);
    if (existing) {
        existing.c++;
    }
    else {
        groups.set(hash, { n: normalized, e: trimmed.slice(0, maxExampleLength), c: 1, cat: classifyCategory(trimmed) });
    }
}
function rankFingerprints(groups) {
    return [...groups.entries()]
        .sort((a, b) => b[1].c - a[1].c)
        .slice(0, maxFingerprints)
        .map(([h, { n, e, c, cat }]) => ({ h, n, e, c, cat: cat === 'non-fatal' ? undefined : cat }));
}
//# sourceMappingURL=error-fingerprint.js.map