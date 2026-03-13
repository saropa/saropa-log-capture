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
import { parseGitHubRemote } from '../../source/link-helpers';

const MAX_BUILD_FILE_BYTES = 512 * 1024; // 512 KB
const API_TIMEOUT_MS = 10_000;

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

function normalizeStatus(s: string): BuildInfo['status'] {
    const lower = s?.toLowerCase() ?? '';
    if (lower === 'success' || lower === 'succeeded' || lower === 'completed') { return 'success'; }
    if (lower === 'failure' || lower === 'failed' || lower === 'failed_' || lower === 'error') { return 'failure'; }
    if (lower === 'cancelled' || lower === 'canceled' || lower === 'skipped') { return 'cancelled'; }
    return 'success';
}

/** Fetch with timeout; returns undefined on error (caller logs). */
async function fetchWithTimeout(
    url: string,
    options: RequestInit & { headers?: Record<string, string> },
): Promise<Response | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: options.headers as HeadersInit,
        });
        return res;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
}

/** GitHub Actions: GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=1 */
async function fetchGitHubActionsBuildInfo(
    context: IntegrationContext,
    token: string | undefined,
): Promise<BuildInfo | undefined> {
    if (!token) { return undefined; }
    const branch = context.sessionContext.devEnvironment?.gitBranch?.trim();
    const remote = context.sessionContext.devEnvironment?.gitRemote?.trim();
    if (!branch || !remote) { return undefined; }
    const slug = parseGitHubRemote(remote);
    if (!slug) { return undefined; }
    const [owner, repo] = slug.split('/');
    if (!owner || !repo) { return undefined; }
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=1`;
    const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res?.ok) { return undefined; }
    const data = await res.json().catch(() => undefined) as { workflow_runs?: Array<{ conclusion?: string; status?: string; id?: number; html_url?: string; head_sha?: string }> };
    const run = data?.workflow_runs?.[0];
    if (!run) { return undefined; }
    const conclusion = (run.conclusion ?? run.status ?? '') as string;
    const status = normalizeStatus(conclusion);
    return {
        status,
        buildId: run.id !== undefined ? String(run.id) : undefined,
        url: typeof run.html_url === 'string' ? run.html_url : undefined,
        commit: typeof run.head_sha === 'string' ? run.head_sha : undefined,
        conclusion,
        timestamp: undefined,
    };
}

/** Azure DevOps: GET .../_apis/build/builds?$top=1&branchName=refs/heads/{branch}&api-version=7.0 */
async function fetchAzureBuildInfo(
    context: IntegrationContext,
    pat: string | undefined,
): Promise<BuildInfo | undefined> {
    if (!pat) { return undefined; }
    const { azureOrg, azureProject } = context.config.integrationsBuildCi;
    if (!azureOrg?.trim() || !azureProject?.trim()) { return undefined; }
    const branch = context.sessionContext.devEnvironment?.gitBranch?.trim();
    if (!branch) { return undefined; }
    const branchRef = `refs/heads/${encodeURIComponent(branch)}`;
    const url = `https://dev.azure.com/${encodeURIComponent(azureOrg)}/${encodeURIComponent(azureProject)}/_apis/build/builds?$top=1&branchName=${encodeURIComponent(branchRef)}&api-version=7.0`;
    const cred = Buffer.from(`:${pat}`).toString('base64');
    const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Basic ${cred}`,
        },
    });
    if (!res?.ok) { return undefined; }
    const data = await res.json().catch(() => undefined) as { value?: Array<{ result?: string; status?: string; buildNumber?: string; _links?: { web?: { href?: string } }; sourceVersion?: string }> };
    const build = data?.value?.[0];
    if (!build) { return undefined; }
    const result = (build.result ?? build.status ?? '') as string;
    const status = normalizeStatus(result);
    const urlLink = build._links?.web?.href;
    return {
        status,
        buildId: typeof build.buildNumber === 'string' ? build.buildNumber : undefined,
        url: typeof urlLink === 'string' ? urlLink : undefined,
        commit: typeof build.sourceVersion === 'string' ? build.sourceVersion : undefined,
        conclusion: result,
        timestamp: undefined,
    };
}

/** GitLab CI: GET /api/v4/projects/{id}/pipelines?ref={branch}&per_page=1 */
async function fetchGitLabBuildInfo(
    context: IntegrationContext,
    token: string | undefined,
): Promise<BuildInfo | undefined> {
    if (!token) { return undefined; }
    const branch = context.sessionContext.devEnvironment?.gitBranch?.trim();
    if (!branch) { return undefined; }
    const { gitlabProjectId, gitlabBaseUrl } = context.config.integrationsBuildCi;
    const projectId = gitlabProjectId?.trim();
    if (!projectId) { return undefined; }
    const base = (gitlabBaseUrl ?? 'https://gitlab.com').replace(/\/$/, '');
    const url = `${base}/api/v4/projects/${encodeURIComponent(projectId)}/pipelines?ref=${encodeURIComponent(branch)}&per_page=1`;
    const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'PRIVATE-TOKEN': token,
        },
    });
    if (!res?.ok) { return undefined; }
    const arr = await res.json().catch(() => undefined) as Array<{ status?: string; id?: number; web_url?: string; sha?: string }>;
    const pipeline = Array.isArray(arr) ? arr[0] : undefined;
    if (!pipeline) { return undefined; }
    const statusStr = (pipeline.status ?? '') as string;
    const status = normalizeStatus(statusStr);
    return {
        status,
        buildId: pipeline.id !== undefined ? String(pipeline.id) : undefined,
        url: typeof pipeline.web_url === 'string' ? pipeline.web_url : undefined,
        commit: typeof pipeline.sha === 'string' ? pipeline.sha : undefined,
        conclusion: statusStr,
        timestamp: undefined,
    };
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
