/**
 * Application / file logs integration: tails configured external log files during
 * session and writes sidecars at session end. If tailers were started, uses
 * buffered lines; otherwise falls back to reading last N lines from each path.
 */

import * as fs from 'node:fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import {
    stopExternalLogTailers,
    getExternalLogBuffers,
    pathToLabel,
} from '../external-log-tailer';

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('externalLogs');
}

function readLastLines(filePath: string, maxLines: number): string[] {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split(/\r?\n/);
        if (lines.length <= maxLines) { return lines; }
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
        if (!cfg.writeSidecars) { return undefined; }
        const workspaceFolder = context.workspaceFolder;
        const contributions: Contribution[] = [];
        const sidecars: string[] = [];

        // Snapshot buffers before stop: finalizeSession must not clear tailers before providers run.
        const tailedBuffers = getExternalLogBuffers();
        stopExternalLogTailers();

        if (tailedBuffers.size > 0) {
            for (const [label, lines] of tailedBuffers) {
                if (lines.length === 0) { continue; }
                const prefix = cfg.prefixLines ? `[${label}] ` : '';
                const content = lines.map((l) => (l ? prefix + l : l)).join('\n');
                const filename = `${context.baseFileName}.${label}.log`;
                contributions.push({ kind: 'sidecar', filename, content, contentType: 'utf8' });
                sidecars.push(filename);
            }
        } else if (cfg.paths.length > 0) {
            for (const relPath of cfg.paths) {
                const uri = resolveWorkspaceFileUri(workspaceFolder, relPath);
                try {
                    const lines = readLastLines(uri.fsPath, cfg.maxLinesPerFile);
                    if (lines.length === 0) { continue; }
                    const label = pathToLabel(relPath);
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
        }

        if (contributions.length === 0) { return undefined; }
        contributions.unshift({ kind: 'meta', key: 'externalLogs', payload: { sidecars } });
        return contributions;
    },
};
