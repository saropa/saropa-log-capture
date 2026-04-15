/**
 * Enrich SQL signals with Drift Advisor table metadata.
 *
 * When the Drift Advisor extension is installed, calls `getSessionSnapshot()`
 * to read schema info (table names, table count) and annotates SQL signal
 * detail strings with matching table metadata (row count, index coverage).
 */

import * as vscode from 'vscode';
import { DRIFT_ADVISOR_EXTENSION_ID, DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS } from '../integrations/drift-advisor-constants';
import type { DriftAdvisorSnapshotLike } from '../integrations/providers/drift-advisor-snapshot-map';
import type { RecurringSignalEntry } from '../misc/recurring-signal-builder';

/** Type guard: DA extension exports `getSessionSnapshot()`. */
function hasSnapshotApi(exports: unknown): exports is { getSessionSnapshot: () => Promise<unknown> } {
    if (!exports || typeof exports !== 'object') { return false; }
    return typeof (exports as Record<string, unknown>).getSessionSnapshot === 'function';
}

/** Fetch the DA snapshot with a bounded timeout. Returns null if unavailable. */
async function fetchDaSnapshot(): Promise<DriftAdvisorSnapshotLike | null> {
    const ext = vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
    if (!ext) { return null; }
    if (!ext.isActive) {
        try { await ext.activate(); } catch { return null; }
    }
    if (!hasSnapshotApi(ext.exports)) { return null; }
    try {
        const result = await Promise.race([
            Promise.resolve(ext.exports.getSessionSnapshot()),
            new Promise<null>(r => setTimeout(() => r(null), DRIFT_ADVISOR_SNAPSHOT_TIMEOUT_MS)),
        ]);
        if (!result || typeof result !== 'object') { return null; }
        return result as DriftAdvisorSnapshotLike;
    } catch {
        return null;
    }
}

/** Extract table names mentioned in a SQL signal label or detail. */
function findMentionedTables(signal: RecurringSignalEntry, knownTables: readonly string[]): string[] {
    const text = ((signal.label ?? '') + ' ' + (signal.detail ?? '')).toLowerCase();
    return knownTables.filter(t => text.includes(t.toLowerCase()));
}

/** Build a short table info suffix from DA schema data. */
function buildTableSuffix(tableNames: readonly string[], snapshot: DriftAdvisorSnapshotLike): string {
    const tableCount = snapshot.schemaSummary?.tableCount ?? 0;
    const parts: string[] = [];
    // Include matched table names and overall schema size for context
    if (tableNames.length > 0) {
        parts.push('tables: ' + tableNames.join(', '));
    }
    if (tableCount > 0) {
        parts.push(tableCount + ' tables in schema');
    }
    const idxCount = snapshot.indexSuggestionsCount;
    if (typeof idxCount === 'number' && idxCount > 0) {
        parts.push(idxCount + ' index suggestion' + (idxCount === 1 ? '' : 's'));
    }
    return parts.length > 0 ? 'DA: ' + parts.join(', ') : '';
}

/**
 * Enrich SQL signals with Drift Advisor table metadata when the extension
 * is installed. Appends schema context (table names, index suggestions)
 * to the signal's detail field. Non-SQL signals are returned unchanged.
 *
 * @param signals All recurring signal entries to potentially enrich
 * @returns The same array with SQL signal details enriched (when DA is available)
 */
export async function enrichSignalsWithDaContext(
    signals: RecurringSignalEntry[],
): Promise<RecurringSignalEntry[]> {
    const hasSqlSignals = signals.some(s => s.kind === 'sql');
    if (!hasSqlSignals) { return signals; }

    const snapshot = await fetchDaSnapshot();
    if (!snapshot) { return signals; }

    const knownTables = snapshot.schemaSummary?.tableNames ?? [];
    return signals.map(signal => {
        if (signal.kind !== 'sql') { return signal; }
        const mentioned = findMentionedTables(signal, knownTables);
        const suffix = buildTableSuffix(mentioned, snapshot);
        if (!suffix) { return signal; }
        return { ...signal, detail: (signal.detail ? signal.detail + ' | ' : '') + suffix };
    });
}
