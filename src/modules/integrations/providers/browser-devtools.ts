/**
 * Browser / DevTools integration (file mode): at session end, read configured
 * browser console log file (JSONL or JSON) and write to sidecar.
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('browser');
}

/** Parse a JSONL string into an array of events, skipping invalid lines. */
function parseJsonlEvents(raw: string, maxEvents: number): unknown[] {
    const events: unknown[] = [];
    for (const line of raw.split(/\r?\n/).filter(Boolean).slice(-maxEvents)) {
        try { events.push(JSON.parse(line)); } catch { /* skip */ }
    }
    return events;
}

export const browserDevtoolsProvider: IntegrationProvider = {
    id: 'browser',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsBrowser;
        if (cfg.mode !== 'file' || !cfg.browserLogPath) { return undefined; }
        try {
            const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.browserLogPath);
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            let events: unknown[] = [];
            if (cfg.browserLogFormat === 'jsonl') {
                events = parseJsonlEvents(raw, cfg.maxEvents);
            } else {
                try {
                    const arr = JSON.parse(raw);
                    const list = Array.isArray(arr) ? arr : [arr];
                    events.push(...list.slice(-cfg.maxEvents));
                } catch {
                    return undefined;
                }
            }
            if (events.length === 0) {return undefined;}
            const sidecarContent = JSON.stringify(events, null, 2);
            const payload = { sidecar: `${context.baseFileName}.browser.json`, count: events.length };
            return [
                { kind: 'meta', key: 'browser', payload },
                { kind: 'sidecar', filename: `${context.baseFileName}.browser.json`, content: sidecarContent, contentType: 'json' },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.outputChannel.appendLine(`[browser] Browser log read failed: ${msg}`);
            return undefined;
        }
    },
};
