/** Cross-session analysis panel — progressive rendering with cancellation. */

import * as vscode from 'vscode';
import { getNonce } from './viewer-content';
import { searchLogFiles, openLogAtLine } from '../modules/log-search';
import { type AnalysisToken, extractAnalysisTokens } from '../modules/line-analyzer';
import { extractSourceReference } from '../modules/source-linker';
import { parseSourceTag } from '../modules/source-tag-parser';
import { analyzeSourceFile } from '../modules/workspace-analyzer';
import { getGitBlame } from '../modules/git-blame';
import { extractFrames, analyzeFrame } from './analysis-frame-handler';
import { getCommitDiff } from '../modules/git-diff';
import { scanDocsForTokens } from '../modules/docs-scanner';
import { extractImports } from '../modules/import-extractor';
import { resolveSymbols } from '../modules/symbol-resolver';
import { normalizeLine, hashFingerprint } from '../modules/error-fingerprint';
import { aggregateInsights } from '../modules/cross-session-aggregator';
import { extractDateFromFilename } from '../modules/stack-parser';
import type { SectionData } from '../modules/analysis-relevance';
import { type RelatedLinesResult, scanRelatedLines } from '../modules/related-lines-scanner';
import { type GitHubContext, getGitHubContext } from '../modules/github-context';
import { renderRelatedLinesSection, type FileAnalysis, renderReferencedFilesSection, renderGitHubSection, renderFirebaseSection } from './analysis-related-render';
import { getFirebaseContext, getCrashEventDetail } from '../modules/firebase-crashlytics';
import { renderCrashDetail } from './analysis-crash-detail';
import { type PostFn, mergeResults, postPendingSlots, postFinalization, postNoSource, buildSourceMetrics } from './analysis-panel-helpers';
import {
    type TokenResultGroup,
    buildProgressiveShell, renderSourceSection, renderLineHistorySection,
    renderDocsSection, renderImportsSection, renderSymbolsSection,
    renderTokenGroups, emptySlot, errorSlot,
} from './analysis-panel-render';

let panel: vscode.WebviewPanel | undefined;
let activeAbort: AbortController | undefined;
let lastFileUri: vscode.Uri | undefined;
const streamTimeout = 15_000;

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

/** Run analysis for a log line and show results in the panel. */
export async function showAnalysis(lineText: string, lineIndex?: number, fileUri?: vscode.Uri): Promise<void> {
    const tokens = extractAnalysisTokens(lineText);
    if (tokens.length === 0) {
        vscode.window.showInformationMessage('No analyzable tokens found in this line.');
        return;
    }
    cancelAnalysis();
    const abort = new AbortController();
    activeAbort = abort;

    ensurePanel();
    lastFileUri = fileUri;
    const sourceRef = extractSourceReference(lineText);
    const sourceToken = tokens.find(t => t.type === 'source-file');
    const sourceTag = parseSourceTag(lineText);
    const frames = await extractFrames(fileUri, lineIndex);
    const hasTag = !!sourceTag;
    panel!.webview.html = buildProgressiveShell(getNonce(), lineText, tokens, !!sourceRef, frames.length > 0 ? frames : undefined, hasTag);

    const posted = new Set<string>();
    const post = (id: string, html: string): void => {
        posted.add(id);
        if (!abort.signal.aborted) { panel?.webview.postMessage({ type: 'sectionReady', id, html }); }
    };

    // Wave 1: quick related-lines scan enriches tokens for all subsequent streams
    let related: RelatedLinesResult | undefined;
    if (sourceTag && fileUri) {
        related = await raceTimeout(scanRelatedLines(fileUri, sourceTag, lineIndex ?? -1), 5000).catch(() => undefined);
    }
    if (abort.signal.aborted) { return; }
    const allTokens = related?.enhancedTokens?.length ? related.enhancedTokens : tokens;
    if (related) { post('related', renderRelatedLinesSection(related, lineIndex ?? -1)); }
    else if (hasTag) { post('related', emptySlot('related', '📋 No related lines found')); }

    // Wave 2: all streams in parallel with enriched tokens
    const results = await Promise.allSettled([
        raceTimeout(runSourceChain(post, abort.signal, sourceToken?.value, sourceRef?.line), streamTimeout),
        raceTimeout(runDocsScan(post, abort.signal, allTokens), streamTimeout),
        raceTimeout(runSymbolResolution(post, abort.signal, allTokens), streamTimeout),
        raceTimeout(runTokenSearch(post, abort.signal, allTokens), streamTimeout),
        raceTimeout(runCrossSessionLookup(lineText), streamTimeout),
        raceTimeout(runReferencedFiles(post, abort.signal, related), streamTimeout),
        raceTimeout(runGitHubLookup(post, abort.signal, related, allTokens), streamTimeout),
        raceTimeout(runFirebaseLookup(post, abort.signal, allTokens), streamTimeout),
    ]);
    if (abort.signal.aborted) { return; }
    postPendingSlots(posted, post, !!sourceRef, hasTag);
    const relatedMetrics: Partial<SectionData> = related ? { relatedLineCount: related.lines.length } : {};
    postFinalization(post, mergeResults(results, relatedMetrics), abort.signal, panel);
}
/** Dispose the singleton panel. */
export function disposeAnalysisPanel(): void { cancelAnalysis(); panel?.dispose(); panel = undefined; }
function cancelAnalysis(): void { activeAbort?.abort(); activeAbort = undefined; }
function postProgress(id: string, message: string): void {
    panel?.webview.postMessage({ type: 'sectionProgress', id, message });
}

async function runSourceChain(post: PostFn, signal: AbortSignal, filename?: string, crashLine?: number): Promise<Partial<SectionData>> {
    if (!filename) { postNoSource(post, '📄 No source file reference found'); return {}; }
    const wsInfo = await analyzeSourceFile(filename, crashLine);
    if (signal.aborted) { return {}; }
    if (!wsInfo) { postNoSource(post, '📄 Source file not found in workspace'); return {}; }
    postProgress('source', '📄 Running git blame...');
    const blame = wsInfo.uri && crashLine
        ? await getGitBlame(wsInfo.uri, crashLine).catch(() => undefined)
        : undefined;
    if (signal.aborted) { return {}; }
    const diff = blame ? await getCommitDiff(blame.hash).catch(() => undefined) : undefined;
    if (signal.aborted) { return {}; }
    post('source', renderSourceSection(wsInfo, blame, diff));
    post('line-history', renderLineHistorySection(wsInfo.lineCommits));
    const metrics = buildSourceMetrics(wsInfo, blame);
    try {
        postProgress('imports', '📦 Parsing imports...');
        const imports = await extractImports(wsInfo.uri);
        if (!signal.aborted) { post('imports', renderImportsSection(imports)); }
        return { ...metrics, importCount: imports.imports.length, localImportCount: imports.localCount };
    } catch {
        if (!signal.aborted) { post('imports', errorSlot('imports', '📦 Import extraction failed')); }
        return metrics;
    }
}

async function runDocsScan(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    if (signal.aborted) { return {}; }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) { post('docs', emptySlot('docs', '📚 No workspace folder open')); return {}; }
    try {
        const names = tokens.map(t => t.value);
        postProgress('docs', '📚 Scanning ' + names.length + ' tokens...');
        const results = await scanDocsForTokens(names, wsFolder);
        if (!signal.aborted) { post('docs', renderDocsSection(results)); }
        return { docMatchCount: results.matches.length };
    } catch {
        if (!signal.aborted) { post('docs', errorSlot('docs', '📚 Documentation scan failed')); }
        return {};
    }
}

async function runSymbolResolution(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    if (signal.aborted) { return {}; }
    try {
        postProgress('symbols', '🔎 Querying language server...');
        const results = await resolveSymbols(tokens);
        if (!signal.aborted) { post('symbols', renderSymbolsSection(results)); }
        return { symbolCount: results.symbols.length };
    } catch {
        if (!signal.aborted) { post('symbols', errorSlot('symbols', '🔎 Symbol resolution failed')); }
        return {};
    }
}

async function runTokenSearch(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    try {
        postProgress('tokens', '🔍 Searching ' + tokens.length + ' token' + (tokens.length > 1 ? 's' : '') + ' across sessions...');
        const groups = await Promise.all(tokens.map(async (token): Promise<TokenResultGroup> => ({
            token, results: await searchLogFiles(token.value, { maxResults: 50, maxResultsPerFile: 10 }),
        })));
        if (signal.aborted) { return {}; }
        post('tokens', renderTokenGroups(groups));
        const total = groups.reduce((s, g) => s + g.results.matches.length, 0);
        const files = new Set(groups.flatMap(g => g.results.matches.map(m => m.filename))).size;
        return { tokenMatchCount: total, tokenFileCount: files };
    } catch {
        if (!signal.aborted) { post('tokens', errorSlot('tokens', '🔍 Token search failed')); }
        return {};
    }
}

async function runCrossSessionLookup(lineText: string): Promise<Partial<SectionData>> {
    try {
        const normalized = normalizeLine(lineText);
        if (normalized.length < 5) { return {}; }
        const hash = hashFingerprint(normalized);
        postProgress('trend', '📊 Reading session metadata...');
        const insights = await aggregateInsights();
        const match = insights.recurringErrors.find(e => e.hash === hash);
        if (!match) { return {}; }
        const firstDate = extractDateFromFilename(match.firstSeen);
        const trend = match.timeline
            .map(t => ({ date: extractDateFromFilename(t.session), count: t.count }))
            .filter((t): t is { date: string; count: number } => t.date !== undefined)
            .sort((a, b) => a.date.localeCompare(b.date));
        return { crossSession: { sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences, firstSeenDate: firstDate, trend } };
    } catch { return {}; }
}

async function runReferencedFiles(post: PostFn, signal: AbortSignal, related?: RelatedLinesResult): Promise<Partial<SectionData>> {
    if (!related) { return {}; }
    if (!related.uniqueFiles.length) { post('files', emptySlot('files', '📁 No source files referenced')); return {}; }
    postProgress('files', '📁 Analyzing ' + related.uniqueFiles.length + ' source files...');
    const refs = related.lines.filter(l => l.sourceRef).map(l => l.sourceRef!);
    const uniqueRefs = [...new Map(refs.map(r => [r.file, r])).values()].slice(0, 5);
    const analyses: FileAnalysis[] = [];
    for (const ref of uniqueRefs) {
        if (signal.aborted) { break; }
        const info = await analyzeSourceFile(ref.file, ref.line).catch(() => undefined);
        if (!info) { continue; }
        const blame = await getGitBlame(info.uri, ref.line).catch(() => undefined);
        analyses.push({ filename: ref.file, line: ref.line, info, blame });
    }
    if (!signal.aborted) { post('files', renderReferencedFilesSection(analyses)); }
    return { relatedFileCount: analyses.length };
}

async function runGitHubLookup(post: PostFn, signal: AbortSignal, related?: RelatedLinesResult, tokens?: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) { post('github', emptySlot('github', '🔗 No workspace folder open')); return {}; }
    postProgress('github', '🔗 Checking GitHub CLI...');
    const files = related?.uniqueFiles ?? [];
    const errorTokens = (tokens ?? []).filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const fallback: GitHubContext = { available: false, setupHint: 'GitHub query failed', filePrs: [], issues: [] };
    const ctx = await getGitHubContext({ files: [...files], errorTokens, cwd }).catch(() => fallback);
    if (!signal.aborted) { post('github', renderGitHubSection(ctx)); }
    return { githubBlamePr: !!ctx.blamePr, githubPrCount: ctx.filePrs.length, githubIssueCount: ctx.issues.length };
}

async function runFirebaseLookup(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    postProgress('firebase', '🔥 Detecting Firebase config...');
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const ctx = await getFirebaseContext(errorTokens).catch(() => ({ available: false, setupHint: 'Firebase query failed', issues: [] as const }));
    if (!signal.aborted) { post('firebase', renderFirebaseSection(ctx)); }
    return { crashlyticsIssueCount: ctx.issues.length };
}

async function fetchCrashDetail(issueId: string): Promise<void> {
    const detail = await getCrashEventDetail(issueId).catch(() => undefined);
    const html = detail ? renderCrashDetail(detail) : '<div class="no-matches">Crash details not available</div>';
    panel?.webview.postMessage({ type: 'crashDetailReady', issueId, html });
}
function postFrameResult(file: string, line: number, html: string): void {
    panel?.webview.postMessage({ type: 'frameReady', file, line, html });
}
function ensurePanel(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.Beside); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.analysis', 'Line Analysis',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { cancelAnalysis(); panel = undefined; });
}

function handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'cancelAnalysis') { cancelAnalysis(); return; }
    if (msg.type === 'analyzeFrame') { analyzeFrame(String(msg.file ?? ''), Number(msg.line ?? 1), postFrameResult).catch(() => {}); return; }
    if (msg.type === 'fetchCrashDetail') { fetchCrashDetail(String(msg.issueId ?? '')).catch(() => {}); return; }
    if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    } else if (msg.type === 'openSource' || msg.type === 'openDoc') {
        const uri = vscode.Uri.parse(String(msg.uri));
        const line = Number(msg.line ?? 1);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
    } else if (msg.type === 'openRelatedLine' && lastFileUri) {
        const ln = Number(msg.line ?? 0);
        vscode.window.showTextDocument(lastFileUri, { selection: new vscode.Range(ln, 0, ln, 0) });
    } else if (msg.type === 'openGitHubUrl' || msg.type === 'openFirebaseUrl') {
        vscode.env.openExternal(vscode.Uri.parse(String(msg.url))).then(undefined, () => {});
    }
}
