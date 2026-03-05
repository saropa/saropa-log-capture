/**
 * Database query logs integration: at session end, read configured query log
 * file (JSON lines) and write to sidecar for correlation by request ID.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('database');
}

export const databaseQueryLogsProvider: IntegrationProvider = {
    id: 'database',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsDatabase;
        if (cfg.mode !== 'file' || !cfg.queryLogPath) { return undefined; }
        try {
            const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.queryLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            const lines = raw.split(/\r?\n/).filter(Boolean);
            const queries: unknown[] = [];
            for (const line of lines.slice(-2000)) {
                try {
                    const obj = JSON.parse(line) as Record<string, unknown>;
                    if (obj && typeof obj === 'object') queries.push(obj);
                } catch {
                    // skip non-JSON lines
                }
            }
            if (queries.length === 0) return undefined;
            const sidecarContent = JSON.stringify({ queries }, null, 2);
            const payload = { sidecar: `${context.baseFileName}.queries.json`, count: queries.length };
            return [
                { kind: 'meta', key: 'database', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.queries.json`, content: sidecarContent, contentType: 'json' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[database] Query log read failed: ${msg}`);
            return undefined;
        }
    },
};
