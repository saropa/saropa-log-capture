/**
 * Cross-session analysis panel.
 *
 * Orchestrates data collection with progressive rendering — sections
 * appear independently as their data arrives. Supports cancellation
 * via AbortController when the user closes the panel or re-analyzes.
 * All HTML rendering lives in analysis-panel-render.ts + styles.
 */

import * as vscode from 'vscode';
import { getNonce } from './viewer-content';
import { searchLogFiles, openLogAtLine } from '../modules/log-search';
import { type AnalysisToken, extractAnalysisTokens } from '../modules/line-analyzer';
import { extractSourceReference } from '../modules/source-linker';
import { analyzeSourceFile } from '../modules/workspace-analyzer';
import { getGitBlame } from '../modules/git-blame';
import { scanDocsForTokens } from '../modules/docs-scanner';
import { extractImports } from '../modules/import-extractor';
import { resolveSymbols } from '../modules/symbol-resolver';
import {
    type TokenResultGroup,
    buildProgressiveShell, renderSourceSection, renderLineHistorySection,
    renderDocsSection, renderImportsSection, renderSymbolsSection,
    renderTokenGroups, emptySlot, errorSlot,
} from './analysis-panel-render';

let panel: vscode.WebviewPanel | undefined;
let activeAbort: AbortController | undefined;

/** Run analysis for a log line and show results in the panel. */
export async function showAnalysis(lineText: string): Promise<void> {
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
    panel!.webview.html = buildProgressiveShell(getNonce(), lineText, tokens, !!sourceRef);

    const post = (id: string, html: string): void => {
        if (!abort.signal.aborted) { panel?.webview.postMessage({ type: 'sectionReady', id, html }); }
    };

    runSourceChain(post, abort.signal, sourceToken?.value, sourceRef?.line).catch(() => {});
    runDocsScan(post, abort.signal, tokens).catch(() => {});
    runSymbolResolution(post, abort.signal, tokens).catch(() => {});
    runTokenSearch(post, abort.signal, tokens).catch(() => {});
}

/** Dispose the singleton panel. */
export function disposeAnalysisPanel(): void { cancelAnalysis(); panel?.dispose(); panel = undefined; }

function cancelAnalysis(): void { activeAbort?.abort(); activeAbort = undefined; }

type PostFn = (id: string, html: string) => void;

async function runSourceChain(post: PostFn, signal: AbortSignal, filename?: string, crashLine?: number): Promise<void> {
    if (!filename) {
        post('source', emptySlot('source', '📄 No source file reference found'));
        post('line-history', emptySlot('line-history', '🕐 No source context'));
        post('imports', emptySlot('imports', '📦 No source context'));
        return;
    }
    const wsInfo = await analyzeSourceFile(filename, crashLine);
    if (signal.aborted) { return; }
    if (!wsInfo) {
        post('source', emptySlot('source', '📄 Source file not found in workspace'));
        post('line-history', emptySlot('line-history', '🕐 No source context'));
        post('imports', emptySlot('imports', '📦 No source context'));
        return;
    }
    const blame = wsInfo.uri && crashLine
        ? await getGitBlame(wsInfo.uri, crashLine).catch(() => undefined)
        : undefined;
    if (signal.aborted) { return; }
    post('source', renderSourceSection(wsInfo, blame));
    post('line-history', renderLineHistorySection(wsInfo.lineCommits));
    try {
        const imports = await extractImports(wsInfo.uri);
        if (!signal.aborted) { post('imports', renderImportsSection(imports)); }
    } catch {
        if (!signal.aborted) { post('imports', errorSlot('imports', '📦 Import extraction failed')); }
    }
}

async function runDocsScan(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<void> {
    if (signal.aborted) { return; }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) { post('docs', emptySlot('docs', '📚 No workspace folder open')); return; }
    try {
        const names = tokens.map(t => t.value);
        const results = await scanDocsForTokens(names, wsFolder);
        if (!signal.aborted) { post('docs', renderDocsSection(results)); }
    } catch {
        if (!signal.aborted) { post('docs', errorSlot('docs', '📚 Documentation scan failed')); }
    }
}

async function runSymbolResolution(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<void> {
    if (signal.aborted) { return; }
    try {
        const results = await resolveSymbols(tokens);
        if (!signal.aborted) { post('symbols', renderSymbolsSection(results)); }
    } catch {
        if (!signal.aborted) { post('symbols', errorSlot('symbols', '🔎 Symbol resolution failed')); }
    }
}

async function runTokenSearch(post: PostFn, signal: AbortSignal, tokens: readonly AnalysisToken[]): Promise<void> {
    try {
        const groups = await Promise.all(tokens.map(async (token): Promise<TokenResultGroup> => ({
            token, results: await searchLogFiles(token.value, { maxResults: 50, maxResultsPerFile: 10 }),
        })));
        if (signal.aborted) { return; }
        post('tokens', renderTokenGroups(groups));
    } catch {
        if (!signal.aborted) { post('tokens', errorSlot('tokens', '🔍 Token search failed')); }
    }
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
    if (msg.type === 'openMatch') {
        const match = { uri: vscode.Uri.parse(String(msg.uri)), filename: String(msg.filename), lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 };
        openLogAtLine(match).catch(() => {});
    } else if (msg.type === 'openSource' || msg.type === 'openDoc') {
        const uri = vscode.Uri.parse(String(msg.uri));
        const line = Number(msg.line ?? 1);
        vscode.window.showTextDocument(uri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) });
    }
}
