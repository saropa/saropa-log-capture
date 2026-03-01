/**
 * Build/CI integration: reads last-build.json (or configured path) at session
 * start and adds last build status and link to header and meta. File-based only.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';

export interface BuildInfo {
    status: 'success' | 'failure' | 'cancelled';
    buildId?: string;
    url?: string;
    commit?: string;
    conclusion?: string;
    timestamp?: string;
}

function isEnabled(context: IntegrationContext): boolean {
    const adapters = context.config.integrationsAdapters ?? [];
    return adapters.includes('buildCi');
}

function getBuildInfoFromFile(
    workspaceFolder: vscode.WorkspaceFolder,
    relativePath: string,
    maxAgeMs: number,
): BuildInfo | undefined {
    try {
        const absPath = path.isAbsolute(relativePath)
            ? relativePath
            : path.join(workspaceFolder.uri.fsPath, relativePath);
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) { return undefined; }
        if (Date.now() - stat.mtimeMs > maxAgeMs) { return undefined; }
        const raw = fs.readFileSync(absPath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, unknown>;
        const status = data.status as string;
        if (status !== 'success' && status !== 'failure' && status !== 'cancelled') {
            return undefined;
        }
        return {
            status: status as BuildInfo['status'],
            buildId: typeof data.buildId === 'string' ? data.buildId : undefined,
            url: typeof data.url === 'string' ? data.url : undefined,
            commit: typeof data.commit === 'string' ? data.commit : undefined,
            conclusion: typeof data.conclusion === 'string' ? data.conclusion : undefined,
            timestamp: typeof data.timestamp === 'string' ? data.timestamp : undefined,
        };
    } catch {
        return undefined;
    }
}

export const buildCiProvider: IntegrationProvider = {
    id: 'buildCi',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { workspaceFolder, config } = context;
        const { buildInfoPath, fileMaxAgeMinutes } = config.integrationsBuildCi;
        const maxAgeMs = fileMaxAgeMinutes * 60 * 1000;
        const info = getBuildInfoFromFile(workspaceFolder, buildInfoPath, maxAgeMs);
        if (!info) { return undefined; }
        const buildLabel = info.buildId ? ` (${info.buildId})` : '';
        const lines: string[] = [`Last build:     ${info.status}${buildLabel}`];
        if (info.url) { lines.push(`Build link:     ${info.url}`); }
        const payload = {
            status: info.status,
            buildId: info.buildId,
            url: info.url,
            commit: info.commit,
            conclusion: info.conclusion,
            timestamp: info.timestamp,
        };
        return [
            { kind: 'header', lines },
            { kind: 'meta', key: 'buildCi', payload },
        ];
    },
};
