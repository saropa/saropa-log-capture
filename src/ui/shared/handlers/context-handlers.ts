/**
 * Integration Context Handlers
 *
 * Handlers for integration context popover and document display.
 *
 * ## Database-tagged lines (Drift SQL)
 *
 * The webview attaches `dbInsight` to `sourceTag === 'database'` rows and may send
 * `hasDatabaseLine: true` with **Show integration context**. When there is no HTTP/perf/etc.
 * data in the ±window and no `saropa-drift-advisor` session meta, we still open the popover
 * so **Database insight** can render from line-local metadata. {@link shouldPostNoIntegrationDataError}
 * encodes that gate for tests and keeps the “empty context” decision in one place.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { t } from '../../../l10n';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadContextData, loadContextFromMeta, type ContextWindow } from '../../../modules/context/context-loader';
import { aggregatePerformance } from '../../../modules/misc/perf-aggregator';
import { parseJSONOrDefault } from '../../../modules/misc/safe-json';
import type { PostFn } from './crashlytics-handlers';

const MAX_SPARKLINE_POINTS = 48;

/**
 * Whether to respond with `noIntegrationData` for the context popover.
 * False positives to avoid: opening an empty popover when the line is not database-tagged
 * and there is truly no integration payload; those stay on the error path.
 */
export function shouldPostNoIntegrationDataError(params: {
    hasContextWindowData: boolean;
    hasDriftAdvisorIntegrationMeta: boolean;
    hasDatabaseLine: boolean;
}): boolean {
    return (
        !params.hasContextWindowData &&
        !params.hasDriftAdvisorIntegrationMeta &&
        !params.hasDatabaseLine
    );
}

interface PerfSample { t: number; freememMb: number; loadAvg1?: number }

/** Load and downsample .perf.json for hero sparkline. Returns undefined if no samples. */
async function loadHeroSparklineData(logUri: vscode.Uri, sessionData: Record<string, unknown> | undefined): Promise<{ times: number[]; freememMb: number[]; loadAvg1: number[] } | undefined> {
    const samplesFile = sessionData?.samplesFile as string | undefined;
    if (!samplesFile || typeof samplesFile !== 'string' || !samplesFile.endsWith('.perf.json')) {
        return undefined;
    }
    const logDir = path.dirname(logUri.fsPath);
    const sidecarPath = path.join(logDir, samplesFile);
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(sidecarPath));
        const data = parseJSONOrDefault<{ samples?: PerfSample[] }>(Buffer.from(content).toString('utf-8'), {});
        const raw = data.samples && Array.isArray(data.samples) ? data.samples : [];
        if (raw.length < 2) { return undefined; }
        const n = Math.min(MAX_SPARKLINE_POINTS, raw.length);
        const step = (raw.length - 1) / (n - 1);
        const times: number[] = [];
        const freememMb: number[] = [];
        const loadAvg1: number[] = [];
        for (let i = 0; i < n; i++) {
            const idx = i === n - 1 ? raw.length - 1 : Math.round(i * step);
            const s = raw[idx];
            times.push(s.t);
            freememMb.push(typeof s.freememMb === 'number' ? s.freememMb : 0);
            loadAvg1.push(typeof s.loadAvg1 === 'number' ? s.loadAvg1 : 0);
        }
        return { times, freememMb, loadAvg1 };
    } catch {
        return undefined;
    }
}

/** Format a single integration entry into display lines. */
function formatIntegrationEntry(key: string, value: unknown): string[] {
    const lines: string[] = [];
    const data = value as Record<string, unknown>;
    const capturedAt = data.capturedAt as number | undefined;
    const sessionWindow = data.sessionWindow as { start: number; end: number } | undefined;
    const header = capturedAt
        ? `${key} (captured at ${new Date(capturedAt).toLocaleTimeString()})`
        : key;
    lines.push(`── ${header} ──`);
    if (sessionWindow) {
        lines.push(`  Session: ${new Date(sessionWindow.start).toLocaleTimeString()} - ${new Date(sessionWindow.end).toLocaleTimeString()}`);
    }
    for (const [k, v] of Object.entries(data)) {
        if (k === 'capturedAt' || k === 'sessionWindow') { continue; }
        let formatted: string;
        if (typeof v === 'object' && v !== null) {
            formatted = JSON.stringify(v, null, 2);
        } else if (typeof v === 'string') {
            formatted = v;
        } else {
            formatted = String(v);
        }
        if (formatted.includes('\n')) {
            lines.push(`  ${k}:`);
            formatted.split('\n').forEach(line => lines.push(`    ${line}`));
        } else {
            lines.push(`  ${k}: ${formatted}`);
        }
    }
    lines.push('');
    return lines;
}

/**
 * Get the center time for context filtering from session metadata.
 */
function getSessionCenterTime(integrations: Record<string, unknown> | undefined): number {
    if (!integrations) { return 0; }
    for (const value of Object.values(integrations)) {
        const data = value as Record<string, unknown>;
        if (data.capturedAt && typeof data.capturedAt === 'number') {
            return data.capturedAt;
        }
        const sw = data.sessionWindow as { start: number; end: number } | undefined;
        if (sw?.start && sw?.end) {
            return Math.round((sw.start + sw.end) / 2);
        }
    }
    return 0;
}

function buildSnapshotSummary(sessionData: Record<string, unknown> | undefined): string | undefined {
    const snap = sessionData?.snapshot as { cpus?: number; totalMemMb?: number; freeMemMb?: number; processMemMb?: number } | undefined;
    if (!snap || typeof snap !== 'object') { return undefined; }
    const parts: string[] = [];
    if (typeof snap.cpus === 'number') { parts.push(`${snap.cpus} CPUs`); }
    if (typeof snap.totalMemMb === 'number') { parts.push(`${snap.totalMemMb} MB RAM`); }
    if (typeof snap.processMemMb === 'number') { parts.push(`process ${snap.processMemMb} MB`); }
    return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Aggregate performance fingerprints and optional session data for current log. */
export async function handlePerformanceRequest(post: PostFn, logUri?: vscode.Uri): Promise<void> {
    const [insights, logContext] = await Promise.all([
        aggregatePerformance('all').catch(() => undefined),
        logUri ? (async () => {
            try {
                const store = new SessionMetadataStore();
                const meta = await store.loadMetadata(logUri);
                const sessionData = meta.integrations?.performance as Record<string, unknown> | undefined;
                const snapshotSummary = buildSnapshotSummary(sessionData);
                const heroSparklineData = await loadHeroSparklineData(logUri, sessionData);
                return {
                    sessionData,
                    errorCount: meta.errorCount,
                    warningCount: meta.warningCount,
                    snapshotSummary,
                    heroSparklineData,
                };
            } catch {
                return undefined;
            }
        })() : Promise.resolve(undefined),
    ]);
    const currentLogLabel = logUri ? path.basename(logUri.fsPath) : undefined;
    const sessionData = logContext?.sessionData;
    post({
        type: 'performanceData',
        trends: insights?.trends ?? [],
        sessionCount: insights?.sessionCount ?? 0,
        sessionData: sessionData ?? undefined,
        currentLogLabel: currentLogLabel ?? undefined,
        heroErrorCount: logContext?.errorCount,
        heroWarningCount: logContext?.warningCount,
        heroSnapshotSummary: logContext?.snapshotSummary,
        heroSparklineData: logContext?.heroSparklineData,
    });
}

/**
 * Show integration context data for a log line as a popover.
 * Filters integration data to ±windowMs of the line timestamp.
 */
export async function handleIntegrationContextRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    post: PostFn,
    options?: { timestamp?: number; hasDatabaseLine?: boolean },
): Promise<void> {
    if (!logUri) {
        post({ type: 'contextPopoverData', error: t('msg.noIntegrationContext') });
        return;
    }
    try {
        const store = new SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);

        const windowMs = vscode.workspace
            .getConfiguration('saropaLogCapture')
            .get<number>('contextWindowSeconds', 5) * 1000;

        const timestamp = options?.timestamp;
        const hasDatabaseLine = options?.hasDatabaseLine === true;
        let centerTime = timestamp && timestamp > 0
            ? timestamp
            : getSessionCenterTime(meta.integrations);
        // Database-tagged lines still show line-local insight even without a captured timestamp.
        if (centerTime === 0 && hasDatabaseLine) {
            centerTime = Date.now();
        }

        if (centerTime === 0) {
            post({ type: 'contextPopoverData', error: t('msg.noIntegrationContext') });
            return;
        }

        const window: ContextWindow = { centerTime, windowMs };
        let contextData = await loadContextData(logUri, window);

        if (!contextData.hasData && meta.integrations) {
            const metaContext = await loadContextFromMeta(meta.integrations, window);
            contextData = { ...contextData, ...metaContext, hasData: Object.keys(metaContext).length > 0 };
        }

        if (
            shouldPostNoIntegrationDataError({
                hasContextWindowData: contextData.hasData,
                hasDriftAdvisorIntegrationMeta: !!meta.integrations?.['saropa-drift-advisor'],
                hasDatabaseLine,
            })
        ) {
            post({ type: 'contextPopoverData', error: t('msg.noIntegrationData') });
            return;
        }

        const driftAdvisorMeta = meta.integrations?.['saropa-drift-advisor'];
        const integrationsMeta = driftAdvisorMeta
            ? { 'saropa-drift-advisor': driftAdvisorMeta }
            : undefined;
        post({
            type: 'contextPopoverData',
            lineIndex,
            timestamp: centerTime,
            windowMs,
            data: { ...contextData, integrationsMeta },
        });
    } catch {
        post({ type: 'contextPopoverData', error: t('msg.noIntegrationContext') });
    }
}

/**
 * Show integration context in a separate document (legacy behavior).
 * Called when user explicitly wants to view full context.
 */
export async function handleIntegrationContextDocument(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
): Promise<void> {
    if (!logUri) {
        vscode.window.showInformationMessage(t('msg.noIntegrationContext'));
        return;
    }
    try {
        const store = new SessionMetadataStore();
        const meta = await store.loadMetadata(logUri);
        const integrations = meta.integrations;
        if (!integrations || Object.keys(integrations).length === 0) {
            vscode.window.showInformationMessage(t('msg.noIntegrationData'));
            return;
        }
        const contextLines: string[] = [`Integration context for line ${lineIndex + 1}:`, ''];
        for (const [key, value] of Object.entries(integrations)) {
            contextLines.push(...formatIntegrationEntry(key, value));
        }
        const doc = await vscode.workspace.openTextDocument({ content: contextLines.join('\n'), language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    } catch {
        vscode.window.showInformationMessage(t('msg.noIntegrationContext'));
    }
}
