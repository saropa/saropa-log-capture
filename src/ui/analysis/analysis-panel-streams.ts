/** Stream functions for the analysis panel — each runs one async analysis pipeline. */

import * as vscode from 'vscode';
import type { AnalysisToken } from '../../modules/analysis/line-analyzer';
import { extractPackageHint } from '../../modules/source/source-linker';
import { analyzeSourceFile } from '../../modules/misc/workspace-analyzer';
import { getGitBlame } from '../../modules/git/git-blame';
import { getCommitDiff } from '../../modules/git/git-diff';
import { getCommitUrl } from '../../modules/integrations/providers/git-source-code';
import { getConfig } from '../../modules/config/config';
import { scanDocsForTokens } from '../../modules/misc/docs-scanner';
import { extractImports } from '../../modules/source/import-extractor';
import { resolveSymbols } from '../../modules/source/symbol-resolver';
import { normalizeLine, hashFingerprint } from '../../modules/analysis/error-fingerprint';
import { aggregateSignals } from '../../modules/misc/cross-session-aggregator';
import { extractDateFromFilename } from '../../modules/analysis/stack-parser';
import { searchLogFiles } from '../../modules/search/log-search';
import type { SectionData } from '../../modules/analysis/analysis-relevance';
import type { RelatedLinesResult } from '../../modules/analysis/related-lines-scanner';
import type { GitHubContext } from '../../modules/git/github-context';
import { getGitHubContext } from '../../modules/git/github-context';
import { renderReferencedFilesSection, type FileAnalysis, renderGitHubSection, renderFirebaseSection } from './analysis-related-render';
import { getFirebaseContext } from '../../modules/crashlytics/firebase-crashlytics';
import { type PostFn, postNoSource, buildSourceMetrics } from './analysis-panel-helpers';
import {
    type TokenResultGroup,
    renderSourceSection, renderLineHistorySection,
    renderDocsSection, renderImportsSection, renderSymbolsSection,
    renderTokenGroups, emptySlot, errorSlot,
} from './analysis-panel-render';

export type ProgressFn = (id: string, message: string) => void;

/** Shared context for all stream functions. */
export interface StreamCtx {
    readonly post: PostFn;
    readonly signal: AbortSignal;
    readonly progress: ProgressFn;
}

export async function runSourceChain(
    ctx: StreamCtx, filename?: string, crashLine?: number,
): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    if (!filename) { postNoSource(post, '📄 No source file reference found'); return {}; }
    const wsInfo = await analyzeSourceFile(filename, crashLine);
    if (signal.aborted) { return {}; }
    if (!wsInfo) { postNoSource(post, '📄 Source file not found in workspace'); return {}; }
    progress('source', '📄 Running git blame...');
    const blame = wsInfo.uri && crashLine
        ? await getGitBlame(wsInfo.uri, crashLine).catch(() => undefined)
        : undefined;
    if (signal.aborted) { return {}; }
    const diff = blame ? await getCommitDiff(blame.hash).catch(() => undefined) : undefined;
    if (signal.aborted) { return {}; }
    let blameCommitUrl: string | undefined;
    if (blame && getConfig().integrationsGit?.commitLinks) {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (cwd) { blameCommitUrl = await getCommitUrl(cwd, blame.hash).catch(() => undefined); }
    }
    post('source', renderSourceSection(wsInfo, blame, diff, blameCommitUrl));
    post('line-history', renderLineHistorySection(wsInfo.lineCommits));
    const metrics = buildSourceMetrics(wsInfo, blame);
    try {
        progress('imports', '📦 Parsing imports...');
        const imports = await extractImports(wsInfo.uri);
        if (!signal.aborted) { post('imports', renderImportsSection(imports)); }
        return { ...metrics, importCount: imports.imports.length, localImportCount: imports.localCount };
    } catch {
        if (!signal.aborted) { post('imports', errorSlot('imports', '📦 Import extraction failed')); }
        return metrics;
    }
}

export async function runDocsScan(ctx: StreamCtx, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    if (signal.aborted) { return {}; }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) { post('docs', emptySlot('docs', '📚 No workspace folder open')); return {}; }
    try {
        const names = tokens.map(t => t.value);
        progress('docs', '📚 Scanning ' + names.length + ' tokens...');
        const results = await scanDocsForTokens(names, wsFolder);
        if (!signal.aborted) { post('docs', renderDocsSection(results)); }
        return { docMatchCount: results.matches.length };
    } catch {
        if (!signal.aborted) { post('docs', errorSlot('docs', '📚 Documentation scan failed')); }
        return {};
    }
}

export async function runSymbolResolution(ctx: StreamCtx, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    if (signal.aborted) { return {}; }
    try {
        progress('symbols', '🔎 Querying language server...');
        const results = await resolveSymbols(tokens);
        if (!signal.aborted) { post('symbols', renderSymbolsSection(results)); }
        return { symbolCount: results.symbols.length };
    } catch {
        if (!signal.aborted) { post('symbols', errorSlot('symbols', '🔎 Symbol resolution failed')); }
        return {};
    }
}

export async function runTokenSearch(ctx: StreamCtx, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    try {
        progress('tokens', '🔍 Searching ' + tokens.length + ' token' + (tokens.length > 1 ? 's' : '') + ' across sessions...');
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

export async function runCrossSessionLookup(
    progress: ProgressFn, lineText: string,
): Promise<Partial<SectionData>> {
    try {
        const normalized = normalizeLine(lineText);
        if (normalized.length < 5) { return {}; }
        const hash = hashFingerprint(normalized);
        progress('trend', '📊 Reading session metadata...');
        const aggregated = await aggregateSignals();
        // Find matching error signal by fingerprint (raw hash for error-kind signals)
        const match = aggregated.allSignals.find(s => s.kind === 'error' && s.fingerprint === hash);
        if (!match) { return {}; }
        const firstDate = extractDateFromFilename(match.firstSeen);
        const trend = match.timeline
            .map(t => ({ date: extractDateFromFilename(t.session), count: t.count }))
            .filter((t): t is { date: string; count: number } => t.date !== undefined)
            .sort((a, b) => a.date.localeCompare(b.date));
        return { crossSession: { sessionCount: match.sessionCount, totalOccurrences: match.totalOccurrences, firstSeenDate: firstDate, trend } };
    } catch { return {}; }
}

export async function runReferencedFiles(ctx: StreamCtx, related?: RelatedLinesResult): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    if (!related) { return {}; }
    if (!related.uniqueFiles.length) { post('files', emptySlot('files', '📁 No source files referenced')); return {}; }
    progress('files', '📁 Analyzing ' + related.uniqueFiles.length + ' source files...');
    const refs = related.lines.filter(l => l.sourceRef).map(l => ({ ...l.sourceRef!, text: l.text }));
    const uniqueRefs = [...new Map(refs.map(r => [r.file, r])).values()].slice(0, 5);
    const analyses = (await Promise.all(uniqueRefs.map(async (ref): Promise<FileAnalysis | undefined> => {
        if (signal.aborted) { return undefined; }
        const info = await analyzeSourceFile(ref.file, ref.line, extractPackageHint(ref.text)).catch(() => undefined);
        if (!info || signal.aborted) { return undefined; }
        const blame = await getGitBlame(info.uri, ref.line).catch(() => undefined);
        return signal.aborted ? undefined : { filename: ref.file, line: ref.line, info, blame };
    }))).filter((a): a is FileAnalysis => a !== undefined);
    if (!signal.aborted) { post('files', renderReferencedFilesSection(analyses)); }
    return { relatedFileCount: analyses.length };
}

export async function runGitHubLookup(
    ctx: StreamCtx, related?: RelatedLinesResult, tokens?: readonly AnalysisToken[],
): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) { post('github', emptySlot('github', '🔗 No workspace folder open')); return {}; }
    progress('github', '🔗 Checking GitHub CLI...');
    const files = related?.uniqueFiles ?? [];
    const errorTokens = (tokens ?? []).filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const fallback: GitHubContext = { available: false, setupHint: 'GitHub query failed', filePrs: [], issues: [] };
    const ghCtx = await getGitHubContext({ files: [...files], errorTokens, cwd }).catch(() => fallback);
    if (!signal.aborted) { post('github', renderGitHubSection(ghCtx)); }
    return { githubBlamePr: !!ghCtx.blamePr, githubPrCount: ghCtx.filePrs.length, githubIssueCount: ghCtx.issues.length };
}

export async function runFirebaseLookup(ctx: StreamCtx, tokens: readonly AnalysisToken[]): Promise<Partial<SectionData>> {
    const { post, signal, progress } = ctx;
    progress('firebase', '🔥 Detecting Firebase config...');
    const errorTokens = tokens.filter(t => t.type === 'error-class' || t.type === 'quoted-string').map(t => t.value);
    const fbCtx = await getFirebaseContext(errorTokens).catch(() => ({ available: false, setupHint: 'Firebase query failed', issues: [] as const }));
    if (!signal.aborted) { post('firebase', renderFirebaseSection(fbCtx)); }
    const top = fbCtx.issues[0];
    const productionImpact = top ? { eventCount: top.eventCount, userCount: top.userCount, issueId: top.id } : undefined;
    return { crashlyticsIssueCount: fbCtx.issues.length, productionImpact };
}
