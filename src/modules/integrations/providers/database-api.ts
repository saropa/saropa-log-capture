/**
 * External API mode for the database integration. At session end, POST the
 * session time range to a user-configured endpoint and receive the queries that
 * ran in that window. The endpoint is the user's own service (configured via
 * the apiUrl setting); the bearer token lives in VS Code SecretStorage, never in
 * settings. This is an opt-in, advanced mode — configuring apiUrl + the token is
 * the authorization for the outbound request.
 */

import * as vscode from 'vscode';
import { fetchWithTimeout } from './build-ci-api';

/** SecretStorage key for the database API bearer token. */
const apiTokenKey = 'saropaLogCapture.database.apiToken';

/** Read the stored database API token, or undefined if none. */
export async function getDatabaseApiToken(ctx: vscode.ExtensionContext): Promise<string | undefined> {
    return (await ctx.secrets.get(apiTokenKey)) ?? undefined;
}

/** Store the database API token in SecretStorage. */
export async function setDatabaseApiToken(ctx: vscode.ExtensionContext, token: string): Promise<void> {
    await ctx.secrets.store(apiTokenKey, token);
}

/** Remove the stored database API token. */
export async function deleteDatabaseApiToken(ctx: vscode.ExtensionContext): Promise<void> {
    await ctx.secrets.delete(apiTokenKey);
}

/** Extract the queries array from a parsed API response ({queries:[...]} or a bare array). */
export function queriesFromResponseBody(body: unknown): unknown[] {
    if (body && typeof body === 'object' && Array.isArray((body as { queries?: unknown }).queries)) {
        return (body as { queries: unknown[] }).queries;
    }
    return Array.isArray(body) ? body : [];
}

/** Options for {@link fetchSessionQueries}. */
export interface FetchSessionQueriesOptions {
    readonly apiUrl: string;
    readonly token?: string;
    readonly startTime: number;
    readonly endTime: number;
    readonly outputChannel: { appendLine(line: string): void };
}

/**
 * POST { startTime, endTime } to the configured endpoint and return the queries.
 * Returns [] on any failure (logged) — API mode never breaks session end.
 */
export async function fetchSessionQueries(opts: FetchSessionQueriesOptions): Promise<unknown[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.token) { headers['Authorization'] = `Bearer ${opts.token}`; }
    const res = await fetchWithTimeout(opts.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startTime: opts.startTime, endTime: opts.endTime }),
    });
    if (!res || !res.ok) {
        opts.outputChannel.appendLine(`[database] API request failed: ${res ? res.status : 'no response'}`);
        return [];
    }
    const body = await res.json().catch(() => undefined);
    return queriesFromResponseBody(body);
}
