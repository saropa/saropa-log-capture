import * as vscode from 'vscode';
import { stripAnsi } from '../capture/ansi';
import { extractSourceReference, extractPackageHint } from '../source/source-linker';
import { isFrameworkFrame, isStackFrameLine, parseThreadHeader } from '../analysis/stack-parser';
import { findInWorkspace, getSourcePreview, getGitHistory, getGitHistoryForLines, type SourceCodePreview, type GitCommit } from '../misc/workspace-analyzer';
import { getGitBlame, type BlameLine } from '../git/git-blame';
import { aggregateSignals } from '../misc/cross-session-aggregator';
import { extractImports, type ImportResults } from '../source/import-extractor';
import type { StackFrame, FileAnalysis, CrossSessionMatch } from './bug-report-collector';

const headerSeparator = '==================';
const maxContextLines = 15;
const maxStackFrames = 100;
const maxAnalyzedFiles = 5;

type WsResult = [SourceCodePreview | undefined, BlameLine | undefined, GitCommit[], CrossSessionMatch | undefined, GitCommit[], ImportResults | undefined];

export function findHeaderEnd(lines: readonly string[]): number {
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        if (lines[i].startsWith(headerSeparator)) { return i + 1; }
    }
    return 0;
}

export function extractEnvironment(lines: readonly string[], headerEnd: number): Record<string, string> {
    const env: Record<string, string> = {};
    for (let i = 0; i < headerEnd; i++) {
        const match = lines[i].match(/^(\w[\w\s.]+?):\s+(.+)$/);
        if (match) { env[match[1].trim()] = match[2].trim(); }
    }
    return env;
}

export function extractLogContext(lines: readonly string[], errorIdx: number): string[] {
    const start = Math.max(0, errorIdx - maxContextLines);
    return lines.slice(start, errorIdx).map(l => stripAnsi(l));
}

export function extractStackTrace(lines: readonly string[], errorIdx: number): StackFrame[] {
    const frames: StackFrame[] = [];
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let currentThread: string | undefined;
    for (let i = errorIdx + 1; i < lines.length && frames.length < maxStackFrames; i++) {
        const line = lines[i];
        if (isStackFrameLine(line)) {
            const text = stripAnsi(line).trimEnd();
            const sourceRef = extractSourceReference(text);
            frames.push({ text, isApp: !isFrameworkFrame(text, wsPath), sourceRef, threadName: currentThread });
        } else {
            const header = parseThreadHeader(stripAnsi(line));
            if (header) { currentThread = header.name; continue; }
            break;
        }
    }
    return frames;
}

export async function collectWorkspaceData(
    filePath: string | undefined, crashLine: number | undefined, fingerprint: string,
): Promise<WsResult> {
    const uri = filePath ? await resolveSourceUri(filePath) : undefined;
    const lineStart = crashLine ? Math.max(1, crashLine - 2) : 0;
    const lineEnd = crashLine ? crashLine + 2 : 0;
    const [preview, blame, history, lineHistory, aggregated, imports] = await Promise.all([
        uri && crashLine ? getSourcePreview(uri, crashLine) : Promise.resolve(undefined),
        uri && crashLine ? getGitBlame(uri, crashLine).catch(() => undefined) : Promise.resolve(undefined),
        uri ? getGitHistory(uri, 10) : Promise.resolve([]),
        uri && crashLine ? getGitHistoryForLines(uri, lineStart, lineEnd) : Promise.resolve([]),
        aggregateSignals(),
        uri ? extractImports(uri).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    // Find matching error signal by fingerprint (raw hash for error-kind signals)
    const match = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === fingerprint);
    const crossMatch = match ? {
        sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences,
        firstSeen: match.firstSeen, lastSeen: match.lastSeen,
    } : undefined;
    return [preview, blame, history, crossMatch, lineHistory, imports];
}

export async function collectFileAnalyses(
    frames: readonly StackFrame[], primaryFile?: string,
): Promise<FileAnalysis[]> {
    const fileMap = new Map<string, { lines: number[]; hint?: string }>();
    for (const f of frames) {
        if (!f.isApp || !f.sourceRef) { continue; }
        const key = f.sourceRef.filePath;
        if (primaryFile && key === primaryFile) { continue; }
        const entry = fileMap.get(key) ?? { lines: [], hint: extractPackageHint(f.text) };
        entry.lines.push(f.sourceRef.line);
        fileMap.set(key, entry);
    }
    const entries = [...fileMap.entries()].slice(0, maxAnalyzedFiles);
    const results = await Promise.all(entries.map(([p, v]) => analyzeOneFile(p, v.lines, v.hint)));
    return results.filter((r): r is FileAnalysis => r !== undefined);
}

async function analyzeOneFile(
    filePath: string, frameLines: readonly number[], hint?: string,
): Promise<FileAnalysis | undefined> {
    const uri = await resolveSourceUri(filePath, hint);
    if (!uri) { return undefined; }
    const [blame, commits] = await Promise.all([
        getGitBlame(uri, frameLines[0]).catch(() => undefined),
        getGitHistory(uri, 5).catch(() => []),
    ]);
    return { filePath, uri, blame, recentCommits: commits, frameLines };
}

async function resolveSourceUri(path: string, hint?: string): Promise<vscode.Uri | undefined> {
    if (/^[A-Za-z]:[\\/]|^\//.test(path)) {
        try {
            const uri = vscode.Uri.file(path);
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch {
            // fall through to workspace search
        }
    }
    const name = path.split(/[\\/]/).pop();
    return name ? findInWorkspace(name, hint) : undefined;
}
