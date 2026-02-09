/** Shared helpers for analysis panel orchestration. */

import * as vscode from 'vscode';
import { type SectionData, scoreRelevance } from '../modules/analysis-relevance';
import type { WorkspaceFileInfo } from '../modules/workspace-analyzer';
import type { BlameLine } from '../modules/git-blame';
import { renderExecutiveSummary } from './analysis-panel-summary';
import { renderTrendSection } from './analysis-trend-render';
import { emptySlot, errorSlot } from './analysis-panel-render';

export type PostFn = (id: string, html: string) => void;

export function mergeResults(settled: PromiseSettledResult<Partial<SectionData>>[], seed: Partial<SectionData> = {}): SectionData {
    let merged: Partial<SectionData> = { ...seed };
    for (const r of settled) {
        if (r.status === 'fulfilled') { merged = { ...merged, ...r.value }; }
    }
    return merged as SectionData;
}

/** Post timeout errors for any sections that never completed. */
export function postPendingSlots(posted: ReadonlySet<string>, post: PostFn, hasSource: boolean, hasTag = false): void {
    const expected = ['docs', 'symbols', 'tokens', 'github', 'firebase',
        ...(hasSource ? ['source', 'line-history', 'imports'] : []),
        ...(hasTag ? ['related', 'files'] : [])];
    for (const id of expected) {
        if (!posted.has(id)) { post(id, errorSlot(id, '⏱ Analysis timed out')); }
    }
}

/** Post trend section, score relevance, and send executive summary. */
export function postFinalization(post: PostFn, data: SectionData, signal: AbortSignal, webviewPanel?: vscode.WebviewPanel): void {
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
        webviewPanel?.webview.postMessage({ type: 'summaryReady', html, collapseSections });
    }
}

export function postNoSource(post: PostFn, sourceLabel: string): void {
    post('source', emptySlot('source', sourceLabel));
    post('line-history', emptySlot('line-history', '🕐 No source context'));
    post('imports', emptySlot('imports', '📦 No source context'));
}

export function buildSourceMetrics(info: WorkspaceFileInfo, blame?: BlameLine): Partial<SectionData> {
    return {
        blame: blame ? { date: blame.date, author: blame.author, hash: blame.hash } : undefined,
        lineCommits: info.lineCommits.map(c => ({ date: c.date })),
        annotations: info.annotations.map(a => ({ type: a.type })),
        gitCommitCount: info.gitCommits.length,
    };
}
