/**
 * Build/CI integration: reads last-build.json (or configured path) at session
 * start and adds last build status and link to header and meta. File-based only.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { safeParseJSON } from '../../misc/safe-json';

const MAX_BUILD_FILE_BYTES = 512 * 1024; // 512 KB

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
        if (!workspaceFolder?.uri) { return undefined; }
        const absPath = resolveWorkspaceFileUri(workspaceFolder, relativePath).fsPath;
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) { return undefined; }
        if (stat.size > MAX_BUILD_FILE_BYTES) { return undefined; }
        if (Date.now() - stat.mtimeMs > maxAgeMs) { return undefined; }
        const raw = fs.readFileSync(absPath, 'utf-8');
        const data = safeParseJSON<Record<string, unknown>>(raw);
        if (!data || typeof data !== 'object') { return undefined; }
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
