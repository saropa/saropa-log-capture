/**
 * Cross-session analysis panel.
 *
 * Orchestrates data collection with progressive rendering — sections
 * appear independently as their data arrives. After all streams finish,
 * scores relevance and posts an executive summary with smart collapse.
 * Supports cancellation via AbortController.
 */

import * as vscode from 'vscode';
import { getNonce } from './viewer-content';
import { searchLogFiles, openLogAtLine } from '../modules/log-search';
import { type AnalysisToken, extractAnalysisTokens } from '../modules/line-analyzer';
import { extractSourceReference } from '../modules/source-linker';
import { analyzeSourceFile } from '../modules/workspace-analyzer';
import { getGitBlame } from '../modules/git-blame';
import { getCommitDiff } from '../modules/git-diff';
import { scanDocsForTokens } from '../modules/docs-scanner';
import { extractImports } from '../modules/import-extractor';
import { resolveSymbols } from '../modules/symbol-resolver';
import { normalizeLine, hashFingerprint } from '../modules/error-fingerprint';
import { aggregateInsights } from '../modules/cross-session-aggregator';
import { isStackFrameLine, extractDateFromFilename, isFrameworkFrame } from '../modules/stack-parser';
import { type SectionData, scoreRelevance } from '../modules/analysis-relevance';
import { renderExecutiveSummary } from './analysis-panel-summary';
import { type StackFrameInfo, renderFrameAnalysis } from './analysis-frame-render';
import { renderTrendSection } from './analysis-trend-render';
import {
    type TokenResultGroup,
    buildProgressiveShell, renderSourceSection, renderLineHistorySection,
    renderDocsSection, renderImportsSection, renderSymbolsSection,
    renderTokenGroups, emptySlot, errorSlot,
} from './analysis-panel-render';

let panel: vscode.WebviewPanel | undefined;
let activeAbort: AbortController | undefined;
/** Max wait per analysis stream — prevents indefinite spinner when VS Code APIs hang. */
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
    const sourceRef = extractSourceReference(lineText);
    const sourceToken = tokens.find(t => t.type === 'source-file');
    const frames = await extractFrames(fileUri, lineIndex);
    panel!.webview.html = buildProgressiveShell(getNonce(), lineText, tokens, !!sourceRef, frames.length > 0 ? frames : undefined);

    const posted = new Set<string>();
    const post = (id: string, html: string): void => {
        posted.add(id);
        if (!abort.signal.aborted) { panel?.webview.postMessage({ type: 'sectionReady', id, html }); }
    };

    const results = await Promise.allSettled([
        raceTimeout(runSourceChain(post, abort.signal, sourceToken?.value, sourceRef?.line), streamTimeout),
        raceTimeout(runDocsScan(post, abort.signal, tokens), streamTimeout),
        raceTimeout(runSymbolResolution(post, abort.signal, tokens), streamTimeout),
        raceTimeout(runTokenSearch(post, abort.signal, tokens), streamTimeout),
        raceTimeout(runCrossSessionLookup(lineText), streamTimeout),
    ]);
    if (abort.signal.aborted) { return; }
    postPendingSlots(posted, post, !!sourceRef);
    postFinalization(post, mergeResults(results), abort.signal);
}

/** Dispose the singleton panel. */
export function disposeAnalysisPanel(): void { cancelAnalysis(); panel?.dispose(); panel = undefined; }

function cancelAnalysis(): void { activeAbort?.abort(); activeAbort = undefined; }

type PostFn = (id: string, html: string) => void;

function mergeResults(settled: PromiseSettledResult<Partial<SectionData>>[]): SectionData {
    let merged: Partial<SectionData> = {};
    for (const r of settled) {
        if (r.status === 'fulfilled') { merged = { ...merged, ...r.value }; }
    }
    return merged as SectionData;
}

/** Post timeout errors for any sections that never completed. */
function postPendingSlots(posted: ReadonlySet<string>, post: PostFn, hasSource: boolean): void {
    const expected = ['docs', 'symbols', 'tokens', ...(hasSource ? ['source', 'line-history', 'imports'] : [])];
    for (const id of expected) {
        if (!posted.has(id)) { post(id, errorSlot(id, '⏱ Analysis timed out')); }
    }
}

/** Post trend section, score relevance, and send executive summary. */
function postFinalization(post: PostFn, data: SectionData, signal: AbortSignal): void {
    const trend = data.crossSession?.trend;
    if (trend && trend.length > 1) {
        post('trend', renderTrendSection(trend, data.crossSession!.sessionCount, data.crossSession!.totalOccurrences));
    } else {
        post('trend', emptySlot('trend', '📊 No cross-session history'));
    }
    const relevance = scoreRelevance(data);
    const html = renderExecutiveSummary(relevance.findings);
    const collapseSections = [...relevance.sectionLevels.entries()]
        .filter(([, level]) => level === 'low').map(([id]) => id);
    if (!signal.aborted) {
        panel?.webview.postMessage({ type: 'summaryReady', html, collapseSections });
    }
}

async function runSourceChain(post: PostFn, signal: AbortSignal, filename?: string, crashLine?: number): Promise<Partial<SectionData>> {
    if (!filename) {
        post('source', emptySlot('source', '📄 No source file reference found'));
        post('line-history', emptySlot('line-history', '🕐 No source context'));
        post('imports', emptySlot('imports', '📦 No source context'));
        return {};
    }
    const wsInfo = await analyzeSourceFile(filename, crashLine);
    if (signal.aborted) { return {}; }
    if (!wsInfo) {
        post('source', emptySlot('source', '📄 Source file not found in workspace'));
        post('line-history', emptySlot('line-history', '🕐 No source context'));
        post('imports', emptySlot('imports', '📦 No source context'));
        return {};
    }
    const blame = wsInfo.uri && crashLine
        ? await getGitBlame(wsInfo.uri, crashLine).catch(() => undefined)
        : undefined;
    if (signal.aborted) { return {}; }
    const diff = blame ? await getCommitDiff(blame.hash).catch(() => undefined) : undefined;
    if (signal.aborted) { return {}; }
    post('source', renderSourceSection(wsInfo, blame, diff));
    post('line-history', renderLineHistorySection(wsInfo.lineCommits));
    const metrics: Partial<SectionData> = {
        blame: blame ? { date: blame.date, author: blame.author, hash: blame.hash } : undefined,
        lineCommits: wsInfo.lineCommits.map(c => ({ date: c.date })),
        annotations: wsInfo.annotations.map(a => ({ type: a.type })),
        gitCommitCount: wsInfo.gitCommits.length,
    };
    try {
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

const maxFrameScan = 30;
const separatorPattern = /^={10,}/;

async function extractFrames(fileUri?: vscode.Uri, lineIndex?: number): Promise<StackFrameInfo[]> {
    if (!fileUri || lineIndex === undefined || lineIndex < 0) { return []; }
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const lines = Buffer.from(raw).toString('utf-8').split('\n');
        let start = lineIndex + 1;
        while (start < lines.length && separatorPattern.test(lines[start].trim())) { start++; }
        const frames: StackFrameInfo[] = [];
        const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        for (let i = start; i < lines.length && frames.length < maxFrameScan; i++) {
            if (!isStackFrameLine(lines[i])) { break; }
            const ref = extractSourceReference(lines[i]);
            frames.push({ text: lines[i].trimEnd(), isApp: !isFrameworkFrame(lines[i], wsPath), sourceRef: ref ?? undefined });
        }
        return frames;
    } catch { return []; }
}

async function runCrossSessionLookup(lineText: string): Promise<Partial<SectionData>> {
    try {
        const normalized = normalizeLine(lineText);
        if (normalized.length < 5) { return {}; }
        const hash = hashFingerprint(normalized);
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

async function analyzeFrame(file: string, line: number): Promise<void> {
    try {
        const info = await analyzeSourceFile(file, line);
        if (!info) { postFrameResult(file, line, '<div class="no-matches">Source not found</div>'); return; }
        const blame = await getGitBlame(info.uri, line).catch(() => undefined);
        postFrameResult(file, line, renderFrameAnalysis(info, blame));
    } catch { postFrameResult(file, line, '<div class="no-matches">Analysis failed</div>'); }
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
    if (msg.type === 'analyzeFrame') { analyzeFrame(String(msg.file ?? ''), Number(msg.line ?? 1)).catch(() => {}); return; }
    if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    } else if (msg.type === 'openSource' || msg.type === 'openDoc') {
        const uri = vscode.Uri.parse(String(msg.uri));
        const line = Number(msg.line ?? 1);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
    }
}
