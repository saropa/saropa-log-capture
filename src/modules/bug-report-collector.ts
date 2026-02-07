/**
 * Bug report data collector.
 *
 * Orchestrates existing modules to gather all evidence for a bug report:
 * error line, stack trace, log context, environment, source code,
 * git history, and cross-session error history.
 */

import * as vscode from 'vscode';
import { stripAnsi } from './ansi';
import { extractSourceReference } from './source-linker';
import { normalizeLine, hashFingerprint } from './error-fingerprint';
import { isFrameworkFrame } from './stack-parser';
import { findInWorkspace, getSourcePreview, getGitHistory, getGitHistoryForLines, type SourceCodePreview, type GitCommit } from './workspace-analyzer';
import { aggregateInsights } from './cross-session-aggregator';
import { collectDevEnvironment, formatDevEnvironment } from './environment-collector';
import { extractAnalysisTokens } from './line-analyzer';
import { scanDocsForTokens, type DocScanResults } from './docs-scanner';
import { extractImports, type ImportResults } from './import-extractor';
import { resolveSymbols, type SymbolResults } from './symbol-resolver';

/** A classified stack frame. */
export interface StackFrame {
    readonly text: string;
    readonly isApp: boolean;
}

/** Cross-session match data for the same error fingerprint. */
export interface CrossSessionMatch {
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string;
    readonly lastSeen: string;
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
    readonly gitHistory: readonly GitCommit[];
    readonly crossSessionMatch?: CrossSessionMatch;
    readonly lineRangeHistory: readonly GitCommit[];
    readonly docMatches?: DocScanResults;
    readonly imports?: ImportResults;
    readonly resolvedSymbols?: SymbolResults;
    readonly logFilename: string;
    readonly lineNumber: number;
}

const maxContextLines = 15;
const maxStackFrames = 100;
const headerSeparator = '==================';

/** Collect all bug report data for an error line. */
export async function collectBugReportData(
    errorText: string, lineIndex: number, fileUri: vscode.Uri,
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

    const tokens = extractAnalysisTokens(cleanError);
    const tokenNames = tokens.map(t => t.value);
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const [wsData, devEnv, docMatches, resolvedSymbols] = await Promise.all([
        collectWorkspaceData(sourceRef?.filePath, sourceRef?.line, fingerprint),
        collectDevEnvironment().then(formatDevEnvironment).catch(() => ({})),
        wsFolder ? scanDocsForTokens(tokenNames, wsFolder).catch(() => undefined) : Promise.resolve(undefined),
        resolveSymbols(tokens).catch(() => undefined),
    ]);
    const [sourcePreview, gitHistory, crossSessionMatch, lineRangeHistory, imports] = wsData;

    return {
        errorLine: cleanError, fingerprint, stackTrace, logContext,
        environment, devEnvironment: devEnv, sourcePreview, gitHistory,
        crossSessionMatch, lineRangeHistory, docMatches, imports,
        resolvedSymbols, logFilename, lineNumber: fileLineIndex + 1,
    };
}

function findHeaderEnd(lines: readonly string[]): number {
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        if (lines[i].startsWith(headerSeparator)) { return i + 1; }
    }
    return 0;
}

function extractEnvironment(lines: readonly string[], headerEnd: number): Record<string, string> {
    const env: Record<string, string> = {};
    for (let i = 0; i < headerEnd; i++) {
        const match = lines[i].match(/^(\w[\w\s.]+?):\s+(.+)$/);
        if (match) { env[match[1].trim()] = match[2].trim(); }
    }
    return env;
}

function extractLogContext(lines: readonly string[], errorIdx: number): string[] {
    const start = Math.max(0, errorIdx - maxContextLines);
    return lines.slice(start, errorIdx).map(l => stripAnsi(l));
}

function extractStackTrace(lines: readonly string[], errorIdx: number): StackFrame[] {
    const frames: StackFrame[] = [];
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    for (let i = errorIdx + 1; i < lines.length && frames.length < maxStackFrames; i++) {
        const line = lines[i];
        if (!isStackFrameLine(line)) { break; }
        const text = stripAnsi(line).trimEnd();
        frames.push({ text, isApp: !isFrameworkFrame(text, wsPath) });
    }
    return frames;
}

function isStackFrameLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) { return false; }
    if (/^\s+at\s/.test(line)) { return true; }
    if (/^#\d+\s/.test(trimmed)) { return true; }
    if (/^\s+File "/.test(line)) { return true; }
    if (/^\s*\u2502\s/.test(line)) { return true; }
    if (/^package:/.test(trimmed)) { return true; }
    return /^\s+\S+\.\S+:\d+/.test(line);
}

type WsResult = [SourceCodePreview | undefined, GitCommit[], CrossSessionMatch | undefined, GitCommit[], ImportResults | undefined];

async function collectWorkspaceData(
    filePath: string | undefined, crashLine: number | undefined, fingerprint: string,
): Promise<WsResult> {
    const uri = filePath ? await findInWorkspace(filePath) : undefined;
    const lineStart = crashLine ? Math.max(1, crashLine - 2) : 0;
    const lineEnd = crashLine ? crashLine + 2 : 0;
    const [preview, history, lineHistory, insights, imports] = await Promise.all([
        uri && crashLine ? getSourcePreview(uri, crashLine) : Promise.resolve(undefined),
        uri ? getGitHistory(uri, 10) : Promise.resolve([]),
        uri && crashLine ? getGitHistoryForLines(uri, lineStart, lineEnd) : Promise.resolve([]),
        aggregateInsights(),
        uri ? extractImports(uri).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    const match = insights.recurringErrors.find(e => e.hash === fingerprint);
    const crossMatch = match ? {
        sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences,
        firstSeen: match.firstSeen, lastSeen: match.lastSeen,
    } : undefined;
    return [preview, history, crossMatch, lineHistory, imports];
}
