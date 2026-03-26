/**
 * Database query logs integration: at session end, either read an external
 * query log file (file mode) or scan the captured session log for inline
 * query blocks (parse mode). Writes a .queries.json sidecar.
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution } from '../types';
import { resolveWorkspaceFileUri } from '../workspace-path';

/** Shape of a single query entry written to the sidecar. */
export interface QueryEntry {
    lineStart: number;
    lineEnd: number;
    queryText: string;
    requestId?: string;
    durationMs?: number;
    timestamp?: number;
}

/** Built-in regex for detecting SQL statement starts. */
const builtinSqlPattern = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE|TRUNCATE|EXPLAIN|WITH)\b/i;

/** Duration pattern: common ORM/log formats like "123ms", "1.5s", "Duration: 42ms". */
const durationPattern = /(?:duration|elapsed|took|time)[=:\s]*(\d+(?:\.\d+)?)\s*(ms|s)\b/i;

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('database');
}

/** Try to parse a JSON string as an object, returning undefined on failure. */
function tryParseJsonObject(line: string): Record<string, unknown> | undefined {
    try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        return obj && typeof obj === 'object' ? obj : undefined;
    } catch { return undefined; }
}

/** Extract duration in ms from a line of text. */
function extractDuration(text: string): number | undefined {
    const m = durationPattern.exec(text);
    if (!m) { return undefined; }
    const val = parseFloat(m[1]);
    return m[2] === 's' ? val * 1000 : val;
}

/**
 * Scan nearby lines (up to 5 above the query start) for a request ID.
 * Returns the first match or undefined.
 */
function findRequestId(
    lines: readonly string[],
    queryLineStart: number,
    requestIdRe: RegExp,
): string | undefined {
    const searchStart = Math.max(0, queryLineStart - 5);
    for (let i = queryLineStart; i >= searchStart; i--) {
        const m = requestIdRe.exec(lines[i]);
        if (m) { return m[1] ?? m[0]; }
    }
    return undefined;
}

/**
 * Parse mode: scan captured session log lines for inline query blocks.
 * Uses queryBlockPattern (user regex) or built-in SQL detection.
 */
export function parseQueryBlocks(
    lines: readonly string[],
    queryBlockPattern: string,
    requestIdPattern: string,
    maxQueries: number,
): QueryEntry[] {
    const blockRe = queryBlockPattern
        ? new RegExp(queryBlockPattern, 'i')
        : builtinSqlPattern;
    const requestIdRe = requestIdPattern
        ? new RegExp(requestIdPattern, 'i')
        : undefined;

    const queries: QueryEntry[] = [];
    let i = 0;
    while (i < lines.length && queries.length < maxQueries) {
        if (!blockRe.test(lines[i])) { i++; continue; }

        const lineStart = i;
        const parts = [lines[i]];
        i++;
        // Continuation: lines starting with whitespace or common SQL
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !blockRe.test(lines[i])) {
            parts.push(lines[i]);
            i++;
        }
        const lineEnd = i - 1;
        const queryText = parts.join('\n').trim();
        if (!queryText) { continue; }

        const entry: QueryEntry = { lineStart, lineEnd, queryText };
        entry.durationMs = extractDuration(lines[lineEnd]) ?? extractDuration(lines[Math.min(lineEnd + 1, lines.length - 1)]);
        if (requestIdRe) {
            entry.requestId = findRequestId(lines, lineStart, requestIdRe);
        }
        queries.push(entry);
    }
    return queries;
}

/** File mode: read external query log file (JSON lines). */
function readFileMode(context: IntegrationEndContext): Contribution[] | undefined {
    const cfg = context.config.integrationsDatabase;
    if (!cfg.queryLogPath) { return undefined; }
    try {
        const uri = resolveWorkspaceFileUri(context.workspaceFolder, cfg.queryLogPath);
        const raw = fs.readFileSync(uri.fsPath, 'utf-8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const queries: unknown[] = [];
        for (const line of lines.slice(-2000)) {
            const obj = tryParseJsonObject(line);
            if (obj) { queries.push(obj); }
        }
        if (queries.length === 0) { return undefined; }
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
}

/** Parse mode: scan session log for inline query blocks. */
async function readParseMode(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
    const cfg = context.config.integrationsDatabase;
    try {
        const logContent = await vscode.workspace.fs.readFile(context.logUri);
        const text = Buffer.from(logContent).toString('utf-8');
        const lines = text.split(/\r?\n/);
        const maxQueries = cfg.maxQueriesPerLookup * 10;
        const queries = parseQueryBlocks(lines, cfg.queryBlockPattern, cfg.requestIdPattern, maxQueries);
        if (queries.length === 0) { return undefined; }
        const sidecarContent = JSON.stringify({ queries }, null, 2);
        const payload = { sidecar: `${context.baseFileName}.queries.json`, count: queries.length, mode: 'parse' };
        return [
            { kind: 'meta', key: 'database', payload },
            { kind: 'sidecar', filename: `${context.baseFileName}.queries.json`, content: sidecarContent, contentType: 'json' },
        ];
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.outputChannel.appendLine(`[database] Parse mode failed: ${msg}`);
        return undefined;
    }
}

export const databaseQueryLogsProvider: IntegrationProvider = {
    id: 'database',

    isEnabled(context: IntegrationContext): boolean {
        return isEnabled(context);
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsDatabase;
        if (cfg.mode === 'file') { return readFileMode(context); }
        if (cfg.mode === 'parse') { return readParseMode(context); }
        return undefined;
    },
};
