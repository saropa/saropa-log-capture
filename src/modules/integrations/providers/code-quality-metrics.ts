/**
 * Code quality metrics provider. At session end, assembles per-file quality data
 * (coverage, lint, comment density) for files referenced in log stack traces.
 * Writes an enriched quality.json sidecar and meta contribution.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { getPerFileCoverageMap } from './code-coverage';
import { lookupCoverage, type CoverageMap } from './coverage-per-file';
import { readLintReport } from './quality-lint-reader';
import { scanCommentDensity } from './quality-comment-scanner';
import { isStackFrameLine, isFrameworkFrame } from '../../analysis/stack-parser';
import { extractSourceReference } from '../../source/source-linker';
import {
    normalizeForLookup,
    type FileQualityMetrics,
    type FileLintData,
    type FileCommentData,
    type CodeQualityPayload,
    type CodeQualitySummary,
    type LowCoverageEntry,
} from './quality-types';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('codeQuality');
}

/**
 * Extract deduplicated app-code file paths from log stack traces.
 * Returns normalized paths suitable for coverage/lint lookup.
 */
export function extractReferencedFiles(logText: string, workspacePath: string): string[] {
    const seen = new Set<string>();
    for (const line of logText.split('\n')) {
        if (!isStackFrameLine(line)) { continue; }
        if (isFrameworkFrame(line, workspacePath)) { continue; }
        const ref = extractSourceReference(line);
        if (!ref) { continue; }
        const norm = ref.filePath.replace(/\\/g, '/');
        seen.add(norm);
    }
    return [...seen];
}

/** Check whether a coverage report file is stale (older than maxHours). */
function isCoverageStale(absPath: string, maxHours: number): boolean {
    if (maxHours <= 0) { return false; }
    try {
        const stat = fs.statSync(absPath);
        const ageMs = Date.now() - stat.mtimeMs;
        return ageMs > maxHours * 3600_000;
    } catch {
        return true;
    }
}

/** Build aggregate summary from per-file metrics. */
export function buildSummary(files: Record<string, FileQualityMetrics>): CodeQualitySummary {
    const entries = Object.entries(files);
    let totalLintWarnings = 0;
    let totalLintErrors = 0;
    let coverageSum = 0;
    let coverageCount = 0;
    const lowCoverage: LowCoverageEntry[] = [];
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
function normalizePathSet(paths: readonly string[]): Set<string> {
    return new Set(paths.map(normalizeForLookup));
}

export const codeQualityMetricsProvider: IntegrationProvider = {
    id: 'codeQuality',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        // Snapshot coverage map before other providers can clear it.
        const coverageMap: CoverageMap | undefined = getPerFileCoverageMap();
        const cfg = context.config.integrationsCodeQuality;
        let logText: string;
        try {
            logText = fs.readFileSync(context.logUri.fsPath, 'utf-8');
        } catch {
            context.outputChannel.appendLine('[codeQuality] Could not read log file.');
            return undefined;
        }
        const referencedFiles = extractReferencedFiles(logText, context.workspaceFolder.uri.fsPath);
        if (referencedFiles.length === 0) { return undefined; }
        const referencedNorm = normalizePathSet(referencedFiles);

        // Check coverage staleness.
        const reportPath = context.config.integrationsCoverage.reportPath;
        const reportAbs = resolveWorkspaceFileUri(context.workspaceFolder, reportPath).fsPath;
        const stale = isCoverageStale(reportAbs, cfg.coverageStaleMaxHours);

        // Lint data.
        let lintMap: ReadonlyMap<string, FileLintData> = new Map();
        if (cfg.lintReportPath) {
            const lintAbs = resolveWorkspaceFileUri(context.workspaceFolder, cfg.lintReportPath).fsPath;
            lintMap = readLintReport(lintAbs, referencedNorm);
        }

        // Comment density.
        let commentMap: ReadonlyMap<string, FileCommentData> = new Map();
        if (cfg.scanComments) {
            commentMap = await scanCommentDensity(context.workspaceFolder, referencedFiles);
        }

        // Assemble per-file metrics.
        const files: Record<string, FileQualityMetrics> = {};
        for (const filePath of referencedFiles) {
            const norm = normalizeForLookup(filePath);
            const lint = lintMap.get(norm);
            const comment = commentMap.get(filePath);
            const metrics: FileQualityMetrics = {
                linePercent: (!stale && coverageMap) ? lookupCoverage(coverageMap, filePath) : undefined,
                lintWarnings: lint?.warnings,
                lintErrors: lint?.errors,
                lintTopMessages: lint?.topMessages,
                commentRatio: comment?.commentRatio,
                documentedExports: comment?.documentedExports,
                totalExports: comment?.totalExports,
            };
            files[filePath] = metrics;
        }

        const payload: CodeQualityPayload = { files, summary: buildSummary(files) };
        const json = JSON.stringify(payload, null, 2);
        const filename = `${context.baseFileName}.quality.json`;
        return [
            { kind: 'sidecar', filename, content: json, contentType: 'json' },
            { kind: 'meta', key: 'codeQuality', payload },
        ];
    },
};
