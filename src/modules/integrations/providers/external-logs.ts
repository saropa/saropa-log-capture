/**
 * Application / file logs integration: at session end, read last N lines from
 * configured external log paths and write to sidecars. (No live tail in v1.)
 */

import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('externalLogs');
}

function readLastLines(filePath: string, maxLines: number): string[] {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split(/\r?\n/);
        if (lines.length <= maxLines) {return lines;}
        return lines.slice(-maxLines);
    } catch {
        return [];
    }
}

export const externalLogsProvider: IntegrationProvider = {
    id: 'externalLogs',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsExternalLogs;
        if (!cfg.paths.length || !cfg.writeSidecars) { return undefined; }
        const workspaceFolder = context.workspaceFolder;
        const contributions: Contribution[] = [];
        const sidecars: string[] = [];

        for (const relPath of cfg.paths) {
            const uri = resolveWorkspaceFileUri(workspaceFolder, relPath);
            try {
                const lines = readLastLines(uri.fsPath, cfg.maxLinesPerFile);
                if (lines.length === 0) {continue;}
                const label = relPath.replace(/[/\\]/g, '_').replace(/\.[^.]+$/, '') || 'external';
                const prefix = cfg.prefixLines ? `[${label}] ` : '';
                const content = lines.map((l) => (l ? prefix + l : l)).join('\n');
                const filename = `${context.baseFileName}.${label}.log`;
                contributions.push({ kind: 'sidecar', filename, content, contentType: 'utf8' });
                sidecars.push(filename);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.outputChannel.appendLine(`[externalLogs] ${relPath}: ${msg}`);
            }
        }
        if (contributions.length === 0) {return undefined;}
        contributions.unshift({ kind: 'meta', key: 'externalLogs', payload: { sidecars } });
        return contributions;
    },
};
