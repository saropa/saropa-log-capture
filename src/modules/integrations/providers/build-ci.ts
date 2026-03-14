/**
 * Build/CI integration: file-based (last-build.json) or API-based (GitHub Actions,
 * Azure DevOps, GitLab CI). Adds last build status and link to header and meta.
 * API fetches run in onSessionStartAsync so they do not block session start.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { safeParseJSON } from '../../misc/safe-json';
import {
    fetchGitHubActionsBuildInfo,
    fetchAzureBuildInfo,
    fetchGitLabBuildInfo,
} from './build-ci-api';

const MAX_BUILD_FILE_BYTES = 512 * 1024; // 512 KB

const SECRET_KEYS = {
    github: 'saropaLogCapture.buildCi.githubToken',
    azure: 'saropaLogCapture.buildCi.azurePat',
    gitlab: 'saropaLogCapture.buildCi.gitlabToken',
} as const;

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

function contributionsFromBuildInfo(info: BuildInfo): Contribution[] {
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
}

export async function getBuildCiGithubToken(extensionContext: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.github) ?? undefined;
    } catch {
        return undefined;
    }
}

export async function setBuildCiGithubToken(extensionContext: vscode.ExtensionContext, token: string): Promise<void> {
    await extensionContext.secrets.store(SECRET_KEYS.github, token);
}

export async function deleteBuildCiGithubToken(extensionContext: vscode.ExtensionContext): Promise<void> {
    await extensionContext.secrets.delete(SECRET_KEYS.github);
}

export async function getBuildCiAzurePat(extensionContext: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.azure) ?? undefined;
    } catch {
        return undefined;
    }
}

export async function setBuildCiAzurePat(extensionContext: vscode.ExtensionContext, pat: string): Promise<void> {
    await extensionContext.secrets.store(SECRET_KEYS.azure, pat);
}

export async function deleteBuildCiAzurePat(extensionContext: vscode.ExtensionContext): Promise<void> {
    await extensionContext.secrets.delete(SECRET_KEYS.azure);
}

export async function getBuildCiGitlabToken(extensionContext: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        return await extensionContext.secrets.get(SECRET_KEYS.gitlab) ?? undefined;
    } catch {
        return undefined;
    }
}

export async function setBuildCiGitlabToken(extensionContext: vscode.ExtensionContext, token: string): Promise<void> {
    await extensionContext.secrets.store(SECRET_KEYS.gitlab, token);
}

export async function deleteBuildCiGitlabToken(extensionContext: vscode.ExtensionContext): Promise<void> {
    await extensionContext.secrets.delete(SECRET_KEYS.gitlab);
}

export const buildCiProvider: IntegrationProvider = {
    id: 'buildCi',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    onSessionStartSync(context: IntegrationContext): Contribution[] | undefined {
        if (!isEnabled(context)) { return undefined; }
        const { source } = context.config.integrationsBuildCi;
        if (source !== 'file') { return undefined; }
        const { workspaceFolder, config } = context;
        const { buildInfoPath, fileMaxAgeMinutes } = config.integrationsBuildCi;
        const maxAgeMs = fileMaxAgeMinutes * 60 * 1000;
        const info = getBuildInfoFromFile(workspaceFolder, buildInfoPath, maxAgeMs);
        if (!info) { return undefined; }
        return contributionsFromBuildInfo(info);
    },

    async onSessionStartAsync(context: IntegrationContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const { source } = context.config.integrationsBuildCi;
        if (source === 'file') { return undefined; }
        const extCtx = context.extensionContext;
        if (!extCtx) {
            context.outputChannel.appendLine('[buildCi] API source requires extension context (SecretStorage).');
            return undefined;
        }
        const { outputChannel } = context;
        let info: BuildInfo | undefined;
        try {
            if (source === 'github') {
                const token = await getBuildCiGithubToken(extCtx);
                info = await fetchGitHubActionsBuildInfo(context, token);
            } else if (source === 'azure') {
                const pat = await getBuildCiAzurePat(extCtx);
                info = await fetchAzureBuildInfo(context, pat);
            } else if (source === 'gitlab') {
                const token = await getBuildCiGitlabToken(extCtx);
                info = await fetchGitLabBuildInfo(context, token);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`[buildCi] onSessionStartAsync failed: ${msg}`);
            return undefined;
        }
        if (!info) { return undefined; }
        return contributionsFromBuildInfo(info);
    },
};
