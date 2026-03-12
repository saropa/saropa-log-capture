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
                try {
                    const obj = JSON.parse(line) as Record<string, unknown>;
                    if (obj && typeof obj === 'object') {requests.push(obj);}
                } catch {
                    // skip non-JSON lines
                }
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
