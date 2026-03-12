/**
 * Integration Context Handlers
 *
 * Handlers for integration context popover and document display.
 */

import * as vscode from 'vscode';
import { t } from '../../../l10n';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadContextData, loadContextFromMeta, type ContextWindow } from '../../../modules/context/context-loader';
import { aggregatePerformance } from '../../../modules/misc/perf-aggregator';
import type { PostFn } from './crashlytics-handlers';

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
        const formatted = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
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

/** Aggregate performance fingerprints and optional session data for current log. */
export async function handlePerformanceRequest(post: PostFn, logUri?: vscode.Uri): Promise<void> {
    const [insights, sessionData] = await Promise.all([
        aggregatePerformance('all').catch(() => undefined),
        logUri ? (async () => {
            try {
                const store = new SessionMetadataStore();
                const meta = await store.loadMetadata(logUri);
                return meta.integrations?.performance as Record<string, unknown> | undefined;
            } catch {
                return undefined;
            }
        })() : Promise.resolve(undefined),
    ]);
    post({
        type: 'performanceData',
        trends: insights?.trends ?? [],
        sessionCount: insights?.sessionCount ?? 0,
        sessionData: sessionData ?? undefined,
    });
}

/**
 * Show integration context data for a log line as a popover.
 * Filters integration data to ±windowMs of the line timestamp.
 */
export async function handleIntegrationContextRequest(
    logUri: vscode.Uri | undefined,
    lineIndex: number,
    timestamp: number | undefined,
    post: PostFn,
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

        const centerTime = timestamp && timestamp > 0
            ? timestamp
            : getSessionCenterTime(meta.integrations);

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

        if (!contextData.hasData) {
            post({ type: 'contextPopoverData', error: t('msg.noIntegrationData') });
            return;
        }

        post({
            type: 'contextPopoverData',
            lineIndex,
            timestamp: centerTime,
            windowMs,
            data: contextData,
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
