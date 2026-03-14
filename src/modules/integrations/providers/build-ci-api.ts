/**
 * Build/CI API fetchers: GitHub Actions, Azure DevOps, GitLab CI.
 */

import type { IntegrationContext } from '../types';
import type { BuildInfo } from './build-ci';
import { parseGitHubRemote } from '../../source/link-helpers';

const API_TIMEOUT_MS = 10_000;

/** Fetch with timeout; returns undefined on error (caller logs). */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit & { headers?: Record<string, string> },
): Promise<Response | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: options.headers,
        });
        return res;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timeout);
    }
}

export function normalizeStatus(s: string): BuildInfo['status'] {
    const lower = s?.toLowerCase() ?? '';
    if (lower === 'success' || lower === 'succeeded' || lower === 'completed') { return 'success'; }
    if (lower === 'failure' || lower === 'failed' || lower === 'failed_' || lower === 'error') { return 'failure'; }
    if (lower === 'cancelled' || lower === 'canceled' || lower === 'skipped') { return 'cancelled'; }
    return 'success';
}

/** GitHub Actions: GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=1 */
export async function fetchGitHubActionsBuildInfo(
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
export async function fetchAzureBuildInfo(
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
export async function fetchGitLabBuildInfo(
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
