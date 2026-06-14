/**
 * OpenTelemetry trace correlation integration. At session end, scans the
 * captured log for trace IDs (W3C traceparent and common trace_id forms) and
 * writes a `.traces.json` sidecar mapping each distinct trace to a backend deep
 * link (built from the configured traceUrlTemplate) and the lines it appeared
 * on. This makes the full trace reachable in the user's trace backend; it does
 * not embed a trace viewer (deferred).
 */

import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { extractTraceHits, traceBackendUrl } from './otel-trace-parse';

/** Max distinct traces recorded in the sidecar; bounds file size on chatty logs. */
const maxTraces = 200;
/** Max line references kept per trace; the full list can be large and is rarely needed. */
const maxLinesPerTrace = 50;

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('otel');
}

/** One trace record written to the sidecar. */
interface TraceRecord {
    traceId: string;
    url?: string;
    lineCount: number;
    lines: number[];
}

export const otelTracesProvider: IntegrationProvider = {
    id: 'otel',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsOtel;
        try {
            const raw = await vscode.workspace.fs.readFile(context.logUri);
            const lines = Buffer.from(raw).toString('utf-8').split(/\r?\n/);
            const hits = extractTraceHits(lines, cfg.traceIdPattern, maxTraces);
            if (hits.length === 0) { return undefined; }

            const traces: TraceRecord[] = hits.map((h) => {
                const url = traceBackendUrl(cfg.traceUrlTemplate, h.traceId);
                return { traceId: h.traceId, ...(url ? { url } : {}), lineCount: h.lines.length, lines: h.lines.slice(0, maxLinesPerTrace) };
            });
            const filename = `${context.baseFileName}.traces.json`;
            return [
                { kind: 'meta', key: 'otel', payload: { sidecar: filename, count: traces.length } },
                { kind: 'sidecar', filename, content: JSON.stringify({ traces }, null, 2), contentType: 'json' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[otel] Trace scan failed: ${msg}`);
            return undefined;
        }
    },
};
