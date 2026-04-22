"use strict";
/**
 * Bug report data collector.
 *
 * Orchestrates existing modules to gather all evidence for a bug report:
 * error line, stack trace, log context, environment, source code,
 * git history, and cross-session error history.
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
exports.collectCollectionContext = collectCollectionContext;
exports.collectBugReportData = collectBugReportData;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("node:path"));
const ansi_1 = require("../capture/ansi");
const config_1 = require("../config/config");
const safe_json_1 = require("../misc/safe-json");
const quality_types_1 = require("../integrations/providers/quality-types");
const source_linker_1 = require("../source/source-linker");
const error_fingerprint_1 = require("../analysis/error-fingerprint");
const environment_collector_1 = require("../misc/environment-collector");
const line_analyzer_1 = require("../analysis/line-analyzer");
const docs_scanner_1 = require("../misc/docs-scanner");
const symbol_resolver_1 = require("../source/symbol-resolver");
const firebase_crashlytics_1 = require("../crashlytics/firebase-crashlytics");
const lint_violation_reader_1 = require("../misc/lint-violation-reader");
const health_score_1 = require("../misc/health-score");
const saropa_lints_refresh_prompt_1 = require("../misc/saropa-lints-refresh-prompt");
const collection_store_1 = require("../collection/collection-store");
const bug_report_collector_helpers_1 = require("./bug-report-collector-helpers");
/** Collect active collection context for bug report, if any. */
async function collectCollectionContext(store) {
    const active = await store.getActiveCollection();
    if (!active) {
        return undefined;
    }
    return {
        name: active.name,
        createdAt: active.createdAt,
        sources: active.sources.map(s => ({ label: s.label, type: s.type, pinnedAt: s.pinnedAt })),
        lastSearchQuery: active.lastSearchQuery,
        notes: active.notes,
    };
}
const LOW_COVERAGE_THRESHOLD = 80;
/** Load quality summary for referenced files (low coverage or lint issues) when includeInBugReport is true. */
async function collectQualitySummary(fileUri, referencedPaths) {
    const config = (0, config_1.getConfig)();
    if (!config.integrationsCodeQuality.includeInBugReport) {
        return undefined;
    }
    if (!(config.integrationsAdapters ?? []).includes('codeQuality')) {
        return undefined;
    }
    const logDir = path.dirname(fileUri.fsPath);
    const baseFileName = path.basename(fileUri.fsPath);
    const qualityPath = path.join(logDir, `${baseFileName}.quality.json`);
    let payload;
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(qualityPath));
        payload = (0, safe_json_1.parseJSONOrDefault)(Buffer.from(content).toString('utf-8'), {});
    }
    catch {
        return undefined;
    }
    if (!payload?.files || typeof payload.files !== 'object') {
        return undefined;
    }
    const fileMetrics = payload.files;
    const referencedNorm = new Set([...referencedPaths].map(quality_types_1.normalizeForLookup));
    const entries = [];
    for (const [filePath, m] of Object.entries(fileMetrics)) {
        const norm = (0, quality_types_1.normalizeForLookup)(filePath);
        if (!referencedNorm.has(norm)) {
            continue;
        }
        const linePercent = m.linePercent;
        const lintWarnings = m.lintWarnings ?? 0;
        const lintErrors = m.lintErrors ?? 0;
        const lowCov = linePercent !== undefined && linePercent < LOW_COVERAGE_THRESHOLD;
        const hasLint = lintWarnings + lintErrors > 0;
        if (lowCov || hasLint) {
            entries.push({ filePath, linePercent, lintWarnings, lintErrors });
        }
    }
    return entries.length > 0 ? entries : undefined;
}
/** Collect all bug report data for an error line. */
async function collectBugReportData(errorText, lineIndex, fileUri, extensionContext) {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const headerEnd = (0, bug_report_collector_helpers_1.findHeaderEnd)(allLines);
    const fileLineIndex = headerEnd + lineIndex;
    const cleanError = (0, ansi_1.stripAnsi)(errorText).trim();
    const normalized = (0, error_fingerprint_1.normalizeLine)(cleanError);
    const fingerprint = (0, error_fingerprint_1.hashFingerprint)(normalized);
    const logFilename = fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    const environment = (0, bug_report_collector_helpers_1.extractEnvironment)(allLines, headerEnd);
    const logContext = (0, bug_report_collector_helpers_1.extractLogContext)(allLines, fileLineIndex);
    const stackTrace = (0, bug_report_collector_helpers_1.extractStackTrace)(allLines, fileLineIndex);
    const sourceRef = (0, source_linker_1.extractSourceReference)(cleanError);
    const referencedPaths = new Set();
    if (sourceRef?.filePath) {
        referencedPaths.add(sourceRef.filePath);
    }
    for (const f of stackTrace) {
        if (f.sourceRef?.filePath) {
            referencedPaths.add(f.sourceRef.filePath);
        }
    }
    const tokens = (0, line_analyzer_1.extractAnalysisTokens)(cleanError);
    const tokenNames = tokens.map(t => t.value);
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const collectionPromise = extensionContext
        ? collectCollectionContext(new collection_store_1.CollectionStore(extensionContext))
        : Promise.resolve(undefined);
    if (wsFolder) {
        await (0, saropa_lints_refresh_prompt_1.offerSaropaLintRefreshIfNeeded)(wsFolder.uri, stackTrace);
    }
    const [wsData, devEnv, docMatches, resolvedSymbols, fileAnalyses, fbCtx, lintMatches, lintHealthScoreParams, collectionContext, qualitySummary] = await Promise.all([
        (0, bug_report_collector_helpers_1.collectWorkspaceData)(sourceRef?.filePath, sourceRef?.line, fingerprint),
        (0, environment_collector_1.collectDevEnvironment)().then(environment_collector_1.formatDevEnvironment).catch(() => ({})),
        wsFolder ? (0, docs_scanner_1.scanDocsForTokens)(tokenNames, wsFolder).catch(() => undefined) : Promise.resolve(undefined),
        (0, symbol_resolver_1.resolveSymbols)(tokens).catch(() => undefined),
        (0, bug_report_collector_helpers_1.collectFileAnalyses)(stackTrace, sourceRef?.filePath),
        (0, firebase_crashlytics_1.getFirebaseContext)(errorTokens).catch(() => undefined),
        wsFolder ? (0, lint_violation_reader_1.findLintMatches)(stackTrace, wsFolder.uri).catch(() => undefined) : Promise.resolve(undefined),
        wsFolder ? (0, health_score_1.getHealthScoreParamsForWorkspace)(wsFolder.uri).catch(() => undefined) : Promise.resolve(undefined),
        collectionPromise,
        collectQualitySummary(fileUri, referencedPaths),
    ]);
    const [sourcePreview, blame, gitHistory, crossSessionMatch, lineRangeHistory, imports] = wsData;
    const topIssue = fbCtx?.issues[0];
    const firebaseMatch = topIssue ? {
        issueTitle: topIssue.title, eventCount: topIssue.eventCount, userCount: topIssue.userCount,
        consoleUrl: fbCtx?.consoleUrl, firstVersion: topIssue.firstVersion, lastVersion: topIssue.lastVersion,
    } : undefined;
    return {
        errorLine: cleanError, fingerprint, stackTrace, logContext,
        environment, devEnvironment: devEnv, sourcePreview, blame, gitHistory,
        crossSessionMatch, lineRangeHistory, docMatches, imports,
        resolvedSymbols, fileAnalyses, primarySourcePath: sourceRef?.filePath,
        logFilename, lineNumber: fileLineIndex + 1, firebaseMatch, lintMatches,
        lintHealthScoreParams,
        collectionContext, qualitySummary,
    };
}
//# sourceMappingURL=bug-report-collector.js.map