/**
 * Workspace-aware analysis: find source files, git history, and code annotations.
 *
 * Searches the user's project (not log files) to provide context about
 * source files referenced in log output.
 */

import * as vscode from 'vscode';
import { execFile } from 'child_process';

/** A git commit from the file's history. */
export interface GitCommit {
    readonly hash: string;
    readonly date: string;
    readonly message: string;
}

/** A TODO/FIXME/HACK/BUG/NOTE annotation found in source code. */
export interface SourceAnnotation {
    readonly line: number;
    readonly type: string;
    readonly text: string;
}

/** A snippet of source code around a target line. */
export interface SourceCodePreview {
    readonly lines: readonly { readonly num: number; readonly text: string }[];
    readonly targetLine: number;
}

/** Result of analyzing a source file in the workspace. */
export interface WorkspaceFileInfo {
    readonly uri: vscode.Uri;
    readonly gitCommits: readonly GitCommit[];
    readonly lineCommits: readonly GitCommit[];
    readonly annotations: readonly SourceAnnotation[];
    readonly sourcePreview?: SourceCodePreview;
}

const annotationPattern = /\b(TODO|FIXME|HACK|BUG|NOTE|XXX)\b[:\s]*(.*)/i;

/** Find a source file in the workspace by filename, preferring app-code directories. */
export async function findInWorkspace(filename: string, packageHint?: string): Promise<vscode.Uri | undefined> {
    const results = await vscode.workspace.findFiles(`**/${filename}`, '**/node_modules/**', 5);
    if (results.length === 0) { return undefined; }
    if (results.length === 1 || !packageHint) { return results[0]; }
    const hintParts = packageHint.split('.').slice(-2);
    const preferred = results.find(r => hintParts.some(p => r.fsPath.includes(p)));
    return preferred ?? results.find(r => /[/\\](?:lib|src|app)[/\\]/i.test(r.fsPath)) ?? results[0];
}

/** Get recent git commits that touched a file. Returns empty on error. */
export async function getGitHistory(uri: vscode.Uri, maxCommits = 15): Promise<GitCommit[]> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return []; }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const format = '--format=%h|%ad|%s';
    const args = ['log', format, '--date=short', `-${maxCommits}`, '--', relPath];
    return runGit(args, root);
}

/** Get git commits that changed a specific line range. Returns empty on error. */
export async function getGitHistoryForLines(uri: vscode.Uri, startLine: number, endLine: number): Promise<GitCommit[]> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return []; }
    const relPath = vscode.workspace.asRelativePath(uri, false);
    const args = ['log', '--format=%h|%ad|%s', '--date=short', '-10', `-L${startLine},${endLine}:${relPath}`];
    return runGit(args, root);
}

/** Scan a source file for TODO/FIXME/HACK/BUG/NOTE annotations. */
export async function findAnnotations(uri: vscode.Uri): Promise<SourceAnnotation[]> {
    const doc = await vscode.workspace.openTextDocument(uri);
    const annotations: SourceAnnotation[] = [];
    for (let i = 0; i < doc.lineCount && annotations.length < 30; i++) {
        const line = doc.lineAt(i).text;
        const match = annotationPattern.exec(line);
        if (match) {
            annotations.push({ line: i + 1, type: match[1].toUpperCase(), text: match[2].trim() || match[0].trim() });
        }
    }
    return annotations;
}

/** Read source lines around a target line. */
export async function getSourcePreview(uri: vscode.Uri, targetLine: number, context = 5): Promise<SourceCodePreview | undefined> {
    const doc = await vscode.workspace.openTextDocument(uri);
    if (targetLine < 1 || targetLine > doc.lineCount) { return undefined; }
    const start = Math.max(0, targetLine - 1 - context);
    const end = Math.min(doc.lineCount - 1, targetLine - 1 + context);
    const lines: { num: number; text: string }[] = [];
    for (let i = start; i <= end; i++) { lines.push({ num: i + 1, text: doc.lineAt(i).text }); }
    return { lines, targetLine };
}

/** Analyze a source file: find it, get git history, annotations, and source preview. */
export async function analyzeSourceFile(filename: string, crashLine?: number, packageHint?: string): Promise<WorkspaceFileInfo | undefined> {
    const uri = await findInWorkspace(filename, packageHint);
    if (!uri) { return undefined; }
    const [gitCommits, lineCommits, annotations, sourcePreview] = await Promise.all([
        getGitHistory(uri),
        crashLine ? getGitHistoryForLines(uri, Math.max(1, crashLine - 2), crashLine + 2) : Promise.resolve([]),
        findAnnotations(uri),
        crashLine ? getSourcePreview(uri, crashLine) : Promise.resolve(undefined),
    ]);
    const allCommits = mergeCommits(gitCommits, lineCommits);
    return { uri, gitCommits: allCommits, lineCommits, annotations, sourcePreview };
}

function mergeCommits(file: GitCommit[], line: GitCommit[]): GitCommit[] {
    const seen = new Set(file.map(c => c.hash));
    return [...file, ...line.filter(c => !seen.has(c.hash))];
}

/** Run a git command and return stdout. Returns empty string on error. */
export function runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 5000 }, (err, stdout) => {
            resolve(err ? '' : (stdout ?? '').trim());
        });
    });
}

function runGit(args: string[], cwd: string): Promise<GitCommit[]> {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 5000 }, (err, stdout) => {
            if (err || !stdout) { resolve([]); return; }
            resolve(stdout.trim().split('\n').filter(Boolean).map(parseCommitLine).filter(Boolean) as GitCommit[]);
        });
    });
}

function parseCommitLine(line: string): GitCommit | undefined {
    const [hash, date, ...rest] = line.split('|');
    if (!hash || !date) { return undefined; }
    return { hash: hash.trim(), date: date.trim(), message: rest.join('|').trim() };
}
