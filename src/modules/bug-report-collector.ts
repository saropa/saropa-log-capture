/**
 * Bug report data collector.
 *
 * Orchestrates existing modules to gather all evidence for a bug report:
 * error line, stack trace, log context, environment, source code,
 * git history, and cross-session error history.
 */

import * as vscode from 'vscode';
import { stripAnsi } from './ansi';
import { extractSourceReference, type SourceReference } from './source-linker';
import { normalizeLine, hashFingerprint } from './error-fingerprint';
import { isFrameworkFrame, isStackFrameLine } from './stack-parser';
import { findInWorkspace, getSourcePreview, getGitHistory, getGitHistoryForLines, type SourceCodePreview, type GitCommit } from './workspace-analyzer';
import { getGitBlame, type BlameLine } from './git-blame';
import { aggregateInsights } from './cross-session-aggregator';
import { collectDevEnvironment, formatDevEnvironment } from './environment-collector';
import { extractAnalysisTokens } from './line-analyzer';
import { scanDocsForTokens, type DocScanResults } from './docs-scanner';
import { extractImports, type ImportResults } from './import-extractor';
import { resolveSymbols, type SymbolResults } from './symbol-resolver';
import { getFirebaseContext } from './firebase-crashlytics';

/** A classified stack frame with optional parsed source reference. */
export interface StackFrame {
    readonly text: string;
    readonly isApp: boolean;
    readonly sourceRef?: SourceReference;
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
}

const maxContextLines = 15;
const maxStackFrames = 100;
const maxAnalyzedFiles = 5;
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
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const [wsData, devEnv, docMatches, resolvedSymbols, fileAnalyses, fbCtx] = await Promise.all([
        collectWorkspaceData(sourceRef?.filePath, sourceRef?.line, fingerprint),
        collectDevEnvironment().then(formatDevEnvironment).catch(() => ({})),
        wsFolder ? scanDocsForTokens(tokenNames, wsFolder).catch(() => undefined) : Promise.resolve(undefined),
        resolveSymbols(tokens).catch(() => undefined),
        collectFileAnalyses(stackTrace, sourceRef?.filePath),
        getFirebaseContext(errorTokens).catch(() => undefined),
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
        logFilename, lineNumber: fileLineIndex + 1, firebaseMatch,
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
        const sourceRef = extractSourceReference(text);
        frames.push({ text, isApp: !isFrameworkFrame(text, wsPath), sourceRef });
    }
    return frames;
}

type WsResult = [SourceCodePreview | undefined, BlameLine | undefined, GitCommit[], CrossSessionMatch | undefined, GitCommit[], ImportResults | undefined];

async function resolveSourceUri(path: string): Promise<vscode.Uri | undefined> {
    if (/^[A-Za-z]:[\\/]|^\//.test(path)) {
        try {
            const uri = vscode.Uri.file(path);
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch { /* fall through to workspace search */ }
    }
    const name = path.split(/[\\/]/).pop();
    return name ? findInWorkspace(name) : undefined;
}

async function collectWorkspaceData(
    filePath: string | undefined, crashLine: number | undefined, fingerprint: string,
): Promise<WsResult> {
    const uri = filePath ? await resolveSourceUri(filePath) : undefined;
    const lineStart = crashLine ? Math.max(1, crashLine - 2) : 0;
    const lineEnd = crashLine ? crashLine + 2 : 0;
    const [preview, blame, history, lineHistory, insights, imports] = await Promise.all([
        uri && crashLine ? getSourcePreview(uri, crashLine) : Promise.resolve(undefined),
        uri && crashLine ? getGitBlame(uri, crashLine).catch(() => undefined) : Promise.resolve(undefined),
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
    return [preview, blame, history, crossMatch, lineHistory, imports];
}

async function collectFileAnalyses(
    frames: readonly StackFrame[], primaryFile?: string,
): Promise<FileAnalysis[]> {
    const fileMap = new Map<string, number[]>();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) { continue; }
        const key = f.sourceRef.filePath;
        if (primaryFile && key === primaryFile) { continue; }
        const arr = fileMap.get(key) ?? [];
        arr.push(f.sourceRef.line);
        fileMap.set(key, arr);
    }
    const entries = [...fileMap.entries()].slice(0, maxAnalyzedFiles);
    const results = await Promise.all(entries.map(([p, lines]) => analyzeOneFile(p, lines)));
    return results.filter((r): r is FileAnalysis => r !== undefined);
}

async function analyzeOneFile(
    filePath: string, frameLines: readonly number[],
): Promise<FileAnalysis | undefined> {
    const uri = await resolveSourceUri(filePath);
    if (!uri) { return undefined; }
    const [blame, commits] = await Promise.all([
        getGitBlame(uri, frameLines[0]).catch(() => undefined),
        getGitHistory(uri, 5).catch(() => []),
    ]);
    return { filePath, uri, blame, recentCommits: commits, frameLines };
}
