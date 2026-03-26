"use strict";
/**
 * Code quality metrics provider. At session end, assembles per-file quality data
 * (coverage, lint, comment density) for files referenced in log stack traces.
 * Writes an enriched quality.json sidecar and meta contribution.
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
exports.codeQualityMetricsProvider = void 0;
exports.extractReferencedFiles = extractReferencedFiles;
exports.buildSummary = buildSummary;
const fs = __importStar(require("fs"));
const workspace_path_1 = require("../workspace-path");
const code_coverage_1 = require("./code-coverage");
const coverage_per_file_1 = require("./coverage-per-file");
const quality_lint_reader_1 = require("./quality-lint-reader");
const quality_comment_scanner_1 = require("./quality-comment-scanner");
const stack_parser_1 = require("../../analysis/stack-parser");
const source_linker_1 = require("../../source/source-linker");
const quality_types_1 = require("./quality-types");
function isEnabled(context) {
    return (context.config.integrationsAdapters ?? []).includes('codeQuality');
}
/**
 * Extract deduplicated app-code file paths from log stack traces.
 * Returns normalized paths suitable for coverage/lint lookup.
 */
function extractReferencedFiles(logText, workspacePath) {
    const seen = new Set();
    for (const line of logText.split('\n')) {
        if (!(0, stack_parser_1.isStackFrameLine)(line)) {
            continue;
        }
        if ((0, stack_parser_1.isFrameworkFrame)(line, workspacePath)) {
            continue;
        }
        const ref = (0, source_linker_1.extractSourceReference)(line);
        if (!ref) {
            continue;
        }
        const norm = ref.filePath.replace(/\\/g, '/');
        seen.add(norm);
    }
    return [...seen];
}
/** Check whether a coverage report file is stale (older than maxHours). */
function isCoverageStale(absPath, maxHours) {
    if (maxHours <= 0) {
        return false;
    }
    try {
        const stat = fs.statSync(absPath);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs > maxHours * 3600_000;
    }
    catch {
        return true;
    }
}
/** Build aggregate summary from per-file metrics. */
function buildSummary(files) {
    const entries = Object.entries(files);
    let totalLintWarnings = 0;
    let totalLintErrors = 0;
    let coverageSum = 0;
    let coverageCount = 0;
    const lowCoverage = [];
    for (const [path, m] of entries) {
        totalLintWarnings += m.lintWarnings ?? 0;
        totalLintErrors += m.lintErrors ?? 0;
        if (m.linePercent !== undefined) {
            coverageSum += m.linePercent;
            coverageCount++;
            lowCoverage.push({ path, linePercent: m.linePercent });
        }
    }
    lowCoverage.sort((a, b) => a.linePercent - b.linePercent);
    return {
        filesAnalyzed: entries.length,
        avgLineCoverage: coverageCount > 0 ? Math.round(coverageSum / coverageCount) : undefined,
        totalLintWarnings,
        totalLintErrors,
        lowestCoverageFiles: lowCoverage.slice(0, 5),
    };
}
/** Normalize paths into a set for lookup matching. */
function normalizePathSet(paths) {
    return new Set(paths.map(quality_types_1.normalizeForLookup));
}
exports.codeQualityMetricsProvider = {
    id: 'codeQuality',
    isEnabled(context) {
        return isEnabled(context);
    },
    async onSessionEnd(context) {
        if (!isEnabled(context)) {
            return undefined;
        }
        // Snapshot coverage map before other providers can clear it.
        const coverageMap = (0, code_coverage_1.getPerFileCoverageMap)();
        const cfg = context.config.integrationsCodeQuality;
        let logText;
        try {
            logText = fs.readFileSync(context.logUri.fsPath, 'utf-8');
        }
        catch {
            context.outputChannel.appendLine('[codeQuality] Could not read log file.');
            return undefined;
        }
        const referencedFiles = extractReferencedFiles(logText, context.workspaceFolder.uri.fsPath);
        if (referencedFiles.length === 0) {
            return undefined;
        }
        const referencedNorm = normalizePathSet(referencedFiles);
        // Check coverage staleness.
        const reportPath = context.config.integrationsCoverage.reportPath;
        const reportAbs = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, reportPath).fsPath;
        const stale = isCoverageStale(reportAbs, cfg.coverageStaleMaxHours);
        // Lint data.
        let lintMap = new Map();
        if (cfg.lintReportPath) {
            const lintAbs = (0, workspace_path_1.resolveWorkspaceFileUri)(context.workspaceFolder, cfg.lintReportPath).fsPath;
            lintMap = (0, quality_lint_reader_1.readLintReport)(lintAbs, referencedNorm);
        }
        // Comment density.
        let commentMap = new Map();
        if (cfg.scanComments) {
            commentMap = await (0, quality_comment_scanner_1.scanCommentDensity)(context.workspaceFolder, referencedFiles);
        }
        // Assemble per-file metrics.
        const files = {};
        for (const filePath of referencedFiles) {
            const norm = (0, quality_types_1.normalizeForLookup)(filePath);
            const lint = lintMap.get(norm);
            const comment = commentMap.get(filePath);
            const metrics = {
                linePercent: (!stale && coverageMap) ? (0, coverage_per_file_1.lookupCoverage)(coverageMap, filePath) : undefined,
                lintWarnings: lint?.warnings,
                lintErrors: lint?.errors,
                lintTopMessages: lint?.topMessages,
                commentRatio: comment?.commentRatio,
                documentedExports: comment?.documentedExports,
                totalExports: comment?.totalExports,
            };
            files[filePath] = metrics;
        }
        const payload = { files, summary: buildSummary(files) };
        const json = JSON.stringify(payload, null, 2);
        const filename = `${context.baseFileName}.quality.json`;
        return [
            { kind: 'sidecar', filename, content: json, contentType: 'json' },
            { kind: 'meta', key: 'codeQuality', payload },
        ];
    },
};
//# sourceMappingURL=code-quality-metrics.js.map