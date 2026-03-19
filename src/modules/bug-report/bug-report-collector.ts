/**
 * Bug report data collector.
 *
 * Orchestrates existing modules to gather all evidence for a bug report:
 * error line, stack trace, log context, environment, source code,
 * git history, and cross-session error history.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import { stripAnsi } from '../capture/ansi';
import { getConfig } from '../config/config';
import { parseJSONOrDefault } from '../misc/safe-json';
import type { CodeQualityPayload } from '../integrations/providers/quality-types';
import { normalizeForLookup } from '../integrations/providers/quality-types';
import { extractSourceReference, type SourceReference } from '../source/source-linker';
import { normalizeLine, hashFingerprint } from '../analysis/error-fingerprint';
import { collectDevEnvironment, formatDevEnvironment } from '../misc/environment-collector';
import { extractAnalysisTokens } from '../analysis/line-analyzer';
import { scanDocsForTokens, type DocScanResults } from '../misc/docs-scanner';
import type { ImportResults } from '../source/import-extractor';
import { resolveSymbols, type SymbolResults } from '../source/symbol-resolver';
import { getFirebaseContext } from '../crashlytics/firebase-crashlytics';
import { findLintMatches, type LintReportData } from '../misc/lint-violation-reader';
import { getHealthScoreParamsForWorkspace, type HealthScoreParams } from '../misc/health-score';
import { offerSaropaLintRefreshIfNeeded } from '../misc/saropa-lints-refresh-prompt';
import { InvestigationStore } from '../investigation/investigation-store';
import {
    collectFileAnalyses,
    collectWorkspaceData,
    extractEnvironment,
    extractLogContext,
    extractStackTrace,
    findHeaderEnd,
} from './bug-report-collector-helpers';
import type { SourceCodePreview, GitCommit } from '../misc/workspace-analyzer';
import type { BlameLine } from '../git/git-blame';

/** Investigation context for bug report when an investigation is active. */
export interface InvestigationContext {
    readonly name: string;
    readonly createdAt: number;
    readonly sources: readonly { label: string; type: string; pinnedAt: number }[];
    readonly lastSearchQuery?: string;
    readonly lastSearchMatchCount?: number;
    readonly notes?: string;
}

/** Collect active investigation context for bug report, if any. */
export async function collectInvestigationContext(store: InvestigationStore): Promise<InvestigationContext | undefined> {
    const active = await store.getActiveInvestigation();
    if (!active) { return undefined; }
    return {
        name: active.name,
        createdAt: active.createdAt,
        sources: active.sources.map(s => ({ label: s.label, type: s.type, pinnedAt: s.pinnedAt })),
        lastSearchQuery: active.lastSearchQuery,
        notes: active.notes,
    };
}

/** A classified stack frame with optional parsed source reference. */
export interface StackFrame {
    readonly text: string;
    readonly isApp: boolean;
    readonly sourceRef?: SourceReference;
    readonly threadName?: string;
}

/** Git analysis data for a source file referenced in the stack trace. */
export interface FileAnalysis {
    readonly filePath: string;
    readonly uri: vscode.Uri;
    readonly blame?: BlameLine;
    readonly recentCommits: readonly GitCommit[];
    readonly frameLines: readonly number[];
}

/** Cross-session match data for the same error fingerprint. */
export interface CrossSessionMatch {
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string;
    readonly lastSeen: string;
}

/** Firebase Crashlytics match for the bug report. */
export interface FirebaseMatch {
    readonly issueTitle: string;
    readonly eventCount: number;
    readonly userCount: number;
    readonly consoleUrl?: string;
    readonly firstVersion?: string;
    readonly lastVersion?: string;
}

/** Per-file quality summary for bug report (low coverage or lint issues). */
export interface QualitySummaryEntry {
    readonly filePath: string;
    readonly linePercent?: number;
    readonly lintWarnings: number;
    readonly lintErrors: number;
}

/** All data gathered for a bug report. */
export interface BugReportData {
    readonly errorLine: string;
    readonly fingerprint: string;
    readonly stackTrace: readonly StackFrame[];
    readonly logContext: readonly string[];
    readonly environment: Record<string, string>;
    readonly devEnvironment: Record<string, string>;
    readonly sourcePreview?: SourceCodePreview;
    readonly blame?: BlameLine;
    readonly gitHistory: readonly GitCommit[];
    readonly crossSessionMatch?: CrossSessionMatch;
    readonly lineRangeHistory: readonly GitCommit[];
    readonly docMatches?: DocScanResults;
    readonly imports?: ImportResults;
    readonly resolvedSymbols?: SymbolResults;
    readonly fileAnalyses: readonly FileAnalysis[];
    readonly primarySourcePath?: string;
    readonly logFilename: string;
    readonly lineNumber: number;
    readonly firebaseMatch?: FirebaseMatch;
    readonly lintMatches?: LintReportData;
    /** Health-score constants for the lint header. Prefer consumer_contract.json when available. */
    readonly lintHealthScoreParams?: HealthScoreParams;
    readonly investigationContext?: InvestigationContext;
    /** Quality summary for referenced files with low coverage or lint issues (when includeInBugReport). */
    readonly qualitySummary?: readonly QualitySummaryEntry[];
}

const LOW_COVERAGE_THRESHOLD = 80;

/** Load quality summary for referenced files (low coverage or lint issues) when includeInBugReport is true. */
async function collectQualitySummary(
    fileUri: vscode.Uri,
    referencedPaths: Set<string>,
): Promise<QualitySummaryEntry[] | undefined> {
    const config = getConfig();
    if (!config.integrationsCodeQuality.includeInBugReport) { return undefined; }
    if (!(config.integrationsAdapters ?? []).includes('codeQuality')) { return undefined; }
    const logDir = path.dirname(fileUri.fsPath);
    const baseFileName = path.basename(fileUri.fsPath);
    const qualityPath = path.join(logDir, `${baseFileName}.quality.json`);
    let payload: CodeQualityPayload;
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(qualityPath));
        payload = parseJSONOrDefault<CodeQualityPayload>(Buffer.from(content).toString('utf-8'), {} as CodeQualityPayload);
    } catch {
        return undefined;
    }
    if (!payload?.files || typeof payload.files !== 'object') { return undefined; }
    const fileMetrics = payload.files;
    const referencedNorm = new Set([...referencedPaths].map(normalizeForLookup));
    const entries: QualitySummaryEntry[] = [];
    for (const [filePath, m] of Object.entries(fileMetrics)) {
        const norm = normalizeForLookup(filePath);
        if (!referencedNorm.has(norm)) { continue; }
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
export async function collectBugReportData(
    errorText: string, lineIndex: number, fileUri: vscode.Uri,
    extensionContext?: vscode.ExtensionContext,
): Promise<BugReportData> {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    const allLines = Buffer.from(raw).toString('utf-8').split('\n');
    const headerEnd = findHeaderEnd(allLines);
    const fileLineIndex = headerEnd + lineIndex;
    const cleanError = stripAnsi(errorText).trim();
    const normalized = normalizeLine(cleanError);
    const fingerprint = hashFingerprint(normalized);
    const logFilename = fileUri.fsPath.split(/[\\/]/).pop() ?? '';

    const environment = extractEnvironment(allLines, headerEnd);
    const logContext = extractLogContext(allLines, fileLineIndex);
    const stackTrace = extractStackTrace(allLines, fileLineIndex);
    const sourceRef = extractSourceReference(cleanError);

    const referencedPaths = new Set<string>();
    if (sourceRef?.filePath) {
        referencedPaths.add(sourceRef.filePath);
    }
    for (const f of stackTrace) {
        if (f.sourceRef?.filePath) {
            referencedPaths.add(f.sourceRef.filePath);
        }
    }

    const tokens = extractAnalysisTokens(cleanError);
    const tokenNames = tokens.map(t => t.value);
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const investigationPromise = extensionContext
        ? collectInvestigationContext(new InvestigationStore(extensionContext))
        : Promise.resolve(undefined);
    if (wsFolder) {
        await offerSaropaLintRefreshIfNeeded(wsFolder.uri, stackTrace);
    }
    const [wsData, devEnv, docMatches, resolvedSymbols, fileAnalyses, fbCtx, lintMatches, lintHealthScoreParams, investigationContext, qualitySummary] = await Promise.all([
        collectWorkspaceData(sourceRef?.filePath, sourceRef?.line, fingerprint),
        collectDevEnvironment().then(formatDevEnvironment).catch(() => ({})),
        wsFolder ? scanDocsForTokens(tokenNames, wsFolder).catch(() => undefined) : Promise.resolve(undefined),
        resolveSymbols(tokens).catch(() => undefined),
        collectFileAnalyses(stackTrace, sourceRef?.filePath),
        getFirebaseContext(errorTokens).catch(() => undefined),
        wsFolder ? findLintMatches(stackTrace, wsFolder.uri).catch(() => undefined) : Promise.resolve(undefined),
        wsFolder ? getHealthScoreParamsForWorkspace(wsFolder.uri).catch(() => undefined) : Promise.resolve(undefined),
        investigationPromise,
        collectQualitySummary(fileUri, referencedPaths),
    ]);
    const [sourcePreview, blame, gitHistory, crossSessionMatch, lineRangeHistory, imports] = wsData;
    const topIssue = fbCtx?.issues[0];
    const firebaseMatch: FirebaseMatch | undefined = topIssue ? {
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
        investigationContext, qualitySummary,
    };
}

