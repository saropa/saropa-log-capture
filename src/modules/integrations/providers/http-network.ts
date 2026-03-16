/**
 * HTTP / network integration: at session end, read configured request log file
 * (JSON lines) and write to sidecar for correlation by request ID.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('http');
}

/** Try to parse a JSON string as an object, returning undefined on failure. */
function tryParseJsonObject(line: string): Record<string, unknown> | undefined {
    try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        return obj && typeof obj === 'object' ? obj : undefined;
    } catch { return undefined; }
}

export const httpNetworkProvider: IntegrationProvider = {
    id: 'http',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsHttp;
        if (!cfg.requestLogPath) { return undefined; }
        try {
            const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.requestLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            const lines = raw.split(/\r?\n/).filter(Boolean);
            const requests: unknown[] = [];
            const cap = Math.min(cfg.maxRequestsPerSession, lines.length);
            for (const line of lines.slice(-cap)) {
                const obj = tryParseJsonObject(line);
                if (obj) { requests.push(obj); }
            }
            if (requests.length === 0) {return undefined;}
            const sidecarContent = JSON.stringify({ requests }, null, 2);
            const payload = { sidecar: `${context.baseFileName}.requests.json`, count: requests.length };
            return [
                { kind: 'meta', key: 'http', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.requests.json`, content: sidecarContent, contentType: 'json' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[http] Request log read failed: ${msg}`);
            return undefined;
        }
    },
};
