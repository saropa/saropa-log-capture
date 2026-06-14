/**
 * Host-side loader for the per-line database-query badge. Reads the
 * `.queries.json` sidecar next to a log file and computes which content lines
 * have correlated queries (by request ID), so the viewer can show a small DB
 * badge without re-running correlation on every render.
 */

import * as vscode from 'vscode';
import { databaseQueryLineCounts, type DatabaseQueryLineCounts } from '../../modules/integrations/providers/database-line-correlation';

/** Build the `.queries.json` sidecar path next to a `.log` file (mirrors findSidecarUris). */
function queriesSidecarPath(logUri: vscode.Uri): string {
    const p = logUri.fsPath;
    const lastDot = p.lastIndexOf('.');
    const base = lastDot > 0 ? p.substring(0, lastDot) : p;
    return base + '.queries.json';
}

/**
 * Read the queries sidecar and map content lines to correlated-query counts.
 * Returns {} when there is no sidecar, no request-ID pattern, or no match — the
 * badge simply does not appear in those cases.
 */
export async function computeDatabaseQueryLineCounts(
    logUri: vscode.Uri,
    contentLines: readonly string[],
    requestIdPattern: string,
): Promise<DatabaseQueryLineCounts> {
    if (!requestIdPattern) { return {}; }
    let queries: unknown[];
    try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(queriesSidecarPath(logUri)));
        const data = JSON.parse(Buffer.from(raw).toString('utf-8')) as { queries?: unknown[] };
        queries = Array.isArray(data.queries) ? data.queries : [];
    } catch {
        // No sidecar or malformed JSON — no badges, not an error.
        return {};
    }
    return databaseQueryLineCounts(contentLines, queries, requestIdPattern);
}
