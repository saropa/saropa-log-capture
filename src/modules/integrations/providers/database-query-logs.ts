/**
 * Database query logs integration: at session end, either read an external
 * query log file (file mode) or scan the captured session log for inline
 * query blocks (parse mode). Writes a .queries.json sidecar.
 *
 * File mode auto-detects JSON-lines vs plain text (MySQL slow log, PostgreSQL
 * log_min_duration_statement, app-emitted SQL) and bounds memory by reading
 * only the tail of large or rotated logs.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import type { IntegrationProvider, IntegrationContext, IntegrationEndContext, Contribution, StreamingWriter } from '../types';
import type { IntegrationDatabaseConfig } from '../../config/config-types-integrations';
import { resolveWorkspaceFileUri } from '../workspace-path';
import { startDatabaseQueryTail, stopDatabaseQueryTail } from '../database-query-tailer';
import { parseQueryBlocks, parseTextQueryLog, detectQueryLogFormat, redactQueryRecord } from './database-query-parsing';

// Re-export pure parsing so tests and callers have a single entry point.
export { parseQueryBlocks, parseTextQueryLog, detectQueryLogFormat, redactSqlLiterals } from './database-query-parsing';
export type { QueryEntry } from './database-query-parsing';

/**
 * Cap bytes read from an external query log. DB logs grow without bound and may
 * be rotated per run; reading only the tail keeps the most recent entries while
 * bounding memory. workspace.fs has no ranged read, so node fs is used here
 * (same pattern as package-lockfile.ts / external-log-tailer.ts).
 */
const fileModeMaxReadBytes = 512 * 1024;

/** Read at most fileModeMaxReadBytes from the END of a file, dropping a partial leading line on tail reads. */
function readTailUtf8(absPath: string): string {
    const fd = fs.openSync(absPath, 'r');
    try {
        const size = fs.fstatSync(fd).size;
        const start = Math.max(0, size - fileModeMaxReadBytes);
        const buf = Buffer.alloc(size - start);
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, start);
        const text = buf.subarray(0, bytesRead).toString('utf-8');
        // A mid-file offset usually lands inside a line; drop that first partial fragment.
        return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
    } finally {
        fs.closeSync(fd);
    }
}

/** Try to parse a JSON string as an object, returning undefined on failure. */
function tryParseJsonObject(line: string): Record<string, unknown> | undefined {
    try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        return obj && typeof obj === 'object' ? obj : undefined;
    } catch { return undefined; }
}

function isEnabled(context: IntegrationContext): boolean {
    return (context.config.integrationsAdapters ?? []).includes('database');
}

/** Auto-detect JSON-lines vs plain text and parse the file's queries; result is capped to bound the sidecar. */
function extractFileQueries(lines: readonly string[], cfg: IntegrationDatabaseConfig): unknown[] {
    const cap = cfg.maxQueriesPerLookup * 10;
    if (detectQueryLogFormat(lines) === 'text') {
        return parseTextQueryLog(lines, cfg.requestIdPattern, cap);
    }
    const queries: unknown[] = [];
    for (const line of lines) {
        const obj = tryParseJsonObject(line);
        if (obj) { queries.push(obj); }
    }
    // Keep the most recent entries when a JSON log holds more than the cap.
    return queries.slice(-cap);
}

/** Build the meta + sidecar contributions for a set of parsed queries. */
function queryContributions(context: IntegrationEndContext, queries: unknown[], mode: 'file' | 'parse'): Contribution[] {
    const filename = `${context.baseFileName}.queries.json`;
    // Redact literal values from SQL before it lands in the shared sidecar; opt-in (default off) per privacy concerns.
    const safeQueries = context.config.integrationsDatabase.redactLiterals
        ? queries.map(redactQueryRecord)
        : queries;
    const sidecarContent = JSON.stringify({ queries: safeQueries }, null, 2);
    const payload = { sidecar: filename, count: queries.length, mode };
    return [
        { kind: 'meta', key: 'database', payload },
        { kind: 'sidecar', filename, content: sidecarContent, contentType: 'json' },
    ];
}

/** File mode: read external query log (JSON lines or plain-text DB server log). */
async function readFileMode(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
    const cfg = context.config.integrationsDatabase;
    if (!cfg.queryLogPath) { return undefined; }
    try {
        const absPath = resolveWorkspaceFileUri(context.workspaceFolder, cfg.queryLogPath).fsPath;
        const lines = readTailUtf8(absPath).split(/\r?\n/).filter(Boolean);
        const queries = extractFileQueries(lines, cfg);
        if (queries.length === 0) { return undefined; }
        return queryContributions(context, queries, 'file');
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
        return queryContributions(context, queries, 'parse');
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

    /**
     * Live tail: when file mode + liveTail are on, stream new query-log entries
     * into the session as they are appended, so queries appear live in the
     * viewer. The end-of-session sidecar (onSessionEnd) still captures the full
     * structured history independently.
     */
    onSessionStartStreaming(context: IntegrationContext, writer: StreamingWriter): void {
        if (!isEnabled(context)) { return; }
        const cfg = context.config.integrationsDatabase;
        if (cfg.mode !== 'file' || !cfg.liveTail || !cfg.queryLogPath) { return; }
        const filePath = resolveWorkspaceFileUri(context.workspaceFolder, cfg.queryLogPath).fsPath;
        startDatabaseQueryTail({
            filePath,
            requestIdPattern: cfg.requestIdPattern,
            outputChannel: context.outputChannel,
            onLine: (text, timestamp) => writer.writeLine(text, 'database', timestamp),
        });
    },

    async onSessionEnd(context: IntegrationEndContext): Promise<Contribution[] | undefined> {
        // Stop the live tail (no-op if it was never started) before the end-of-session read.
        stopDatabaseQueryTail();
        if (!isEnabled(context)) { return undefined; }
        const cfg = context.config.integrationsDatabase;
        if (cfg.mode === 'file') { return readFileMode(context); }
        if (cfg.mode === 'parse') { return readParseMode(context); }
        return undefined;
    },
};
