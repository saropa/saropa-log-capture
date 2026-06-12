/**
 * Pure shaping of DAILY error-count metric-set rows into a per-issue daily series for the list trend
 * mini-chart. Kept free of `vscode` and the network layer (which `play-reporting-metrics.ts` pulls in
 * via the diagnostics module) so it is unit-testable under `node --test`.
 */

type Json = Record<string, unknown>;

/** Read a named dimension's value off a metric-set row (the field varies by dimension type). */
function rowDimValue(row: Json, name: string): string {
    const dims = (row.dimensions as Json[] | undefined) ?? [];
    const dim = dims.find(d => d.dimension === name);
    if (!dim) { return ''; }
    return String(dim.stringValue ?? dim.int64Value ?? dim.valueLabel ?? '').trim();
}

/** Read a row's errorReportCount metric as a number (0 when absent). */
function rowCount(row: Json): number {
    const metrics = (row.metrics as Json[] | undefined) ?? [];
    const metric = metrics.find(m => m.metric === 'errorReportCount');
    return Number((metric?.decimalValue as { value?: string } | undefined)?.value ?? 0);
}

/** A sortable day ordinal from a row's `startTime` ({year,month,day}); 0 when absent. */
function rowDayOrdinal(row: Json): number {
    const st = row.startTime as { year?: number; month?: number; day?: number } | undefined;
    if (!st?.year) { return 0; }
    return st.year * 10000 + (st.month ?? 0) * 100 + (st.day ?? 0);
}

/**
 * Group DAILY error-count rows into a per-issue daily series (oldest→newest), keyed by the issueId
 * dimension. Each issue's counts are ordered by day so the sparkline reads left-to-right in time.
 */
export function buildTrends(json: Json | undefined): Record<string, number[]> {
    const rows = (json?.rows as Json[] | undefined) ?? [];
    const byIssue: Record<string, { ord: number; count: number }[]> = {};
    for (const row of rows) {
        const issueId = rowDimValue(row, 'issueId');
        if (!issueId) { continue; }
        (byIssue[issueId] ??= []).push({ ord: rowDayOrdinal(row), count: rowCount(row) });
    }
    const out: Record<string, number[]> = {};
    for (const id of Object.keys(byIssue)) {
        out[id] = byIssue[id].sort((a, b) => a.ord - b.ord).map(x => x.count);
    }
    return out;
}
