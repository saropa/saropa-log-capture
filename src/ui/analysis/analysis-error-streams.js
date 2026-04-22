"use strict";
/**
 * Stream functions for error-specific analysis in the analysis panel.
 *
 * These run in parallel with existing streams when the analyzed line
 * is classified as an error/warning. They fetch triage status,
 * session occurrences, and cross-session timeline data.
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
exports.buildErrorContext = buildErrorContext;
exports.runTriageLookup = runTriageLookup;
exports.runErrorTimeline = runErrorTimeline;
exports.runOccurrenceScan = runOccurrenceScan;
const vscode = __importStar(require("vscode"));
const error_fingerprint_1 = require("../../modules/analysis/error-fingerprint");
const cross_session_aggregator_1 = require("../../modules/misc/cross-session-aggregator");
const error_status_store_1 = require("../../modules/misc/error-status-store");
const analysis_error_render_1 = require("./analysis-error-render");
const analysis_panel_render_1 = require("./analysis-panel-render");
/** Compute error context from raw line text. Returns undefined if not fingerprintable. */
function buildErrorContext(lineText, errorClass) {
    const normalized = (0, error_fingerprint_1.normalizeLine)(lineText);
    if (normalized.length < 5) {
        return undefined;
    }
    return {
        hash: (0, error_fingerprint_1.hashFingerprint)(normalized),
        normalizedText: normalized,
        crashCategory: (0, error_fingerprint_1.classifyCategory)(lineText),
        errorClass,
    };
}
/** Fetch triage status and post the error header section. */
async function runTriageLookup(ctx, lineText, errCtx) {
    const { post, signal } = ctx;
    const statuses = await (0, error_status_store_1.getErrorStatusBatch)([errCtx.hash]).catch(() => ({}));
    if (signal.aborted) {
        return {};
    }
    const triageStatus = statuses[errCtx.hash] ?? 'open';
    const headerOpts = {
        errorText: lineText,
        errorClass: errCtx.errorClass,
        crashCategory: errCtx.crashCategory,
        hash: errCtx.hash,
        triageStatus,
    };
    post('error-header', (0, analysis_error_render_1.renderErrorHeader)(headerOpts));
    return {};
}
/** Fetch cross-session error timeline and post the section. */
async function runErrorTimeline(ctx, errCtx) {
    const { post, signal, progress } = ctx;
    progress('error-timeline', '📊 Loading error history...');
    const aggregated = await (0, cross_session_aggregator_1.aggregateSignals)('all').catch(() => undefined);
    if (signal.aborted) {
        return {};
    }
    // Find matching error signal by fingerprint (which is the raw hash for error-kind signals)
    const match = aggregated?.allSignals.find(s => s.kind === 'error' && s.fingerprint === errCtx.hash);
    if (!match) {
        post('error-timeline', (0, analysis_panel_render_1.emptySlot)('error-timeline', '📊 First occurrence — no history yet'));
        return {};
    }
    post('error-timeline', (0, analysis_error_render_1.renderTimelineSection)(match));
    return {};
}
/** Scan current session fingerprints for occurrences of this error. */
async function runOccurrenceScan(ctx, errCtx, fileUri) {
    const { post, signal, progress } = ctx;
    if (!fileUri) {
        post('error-occurrences', (0, analysis_panel_render_1.emptySlot)('error-occurrences', '🔁 No session file'));
        return {};
    }
    progress('error-occurrences', '🔁 Scanning session...');
    const maxScanLines = 50_000;
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        if (signal.aborted) {
            return {};
        }
        const text = Buffer.from(raw).toString('utf-8');
        const lines = text.split('\n');
        const limit = Math.min(lines.length, maxScanLines);
        const examples = [];
        for (let i = 0; i < limit; i++) {
            const trimmed = lines[i].trim();
            const n = (0, error_fingerprint_1.normalizeLine)(trimmed);
            if (n.length >= 5 && (0, error_fingerprint_1.hashFingerprint)(n) === errCtx.hash) {
                examples.push(trimmed);
            }
        }
        post('error-occurrences', (0, analysis_error_render_1.renderOccurrencesSection)(examples.length, examples));
    }
    catch {
        post('error-occurrences', (0, analysis_panel_render_1.emptySlot)('error-occurrences', '🔁 Could not scan session'));
    }
    return {};
}
//# sourceMappingURL=analysis-error-streams.js.map