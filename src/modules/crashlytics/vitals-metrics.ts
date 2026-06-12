/**
 * Pure extraction of named metrics from a Vitals metric-set response, as percentages. Kept free of
 * `vscode`/network so it is unit-testable. Selects a metric BY NAME (not "the first one"), which is
 * required now that the crash query asks for both `crashRate` and `userPerceivedCrashRate` in one call.
 *
 * The response's per-row `metrics` is read defensively in both observed shapes — an array of
 * `{metric, decimalValue}` (how the error-count metric set returns them) and a name-keyed object — so
 * a shape difference between metric sets can't silently zero a rate.
 */

import type { VitalsQueryResponse, VitalsRow } from './google-play-vitals-types';

/** Raw decimal string for a named metric on a row, across both array and name-keyed shapes. */
function rawMetricValue(metrics: VitalsRow['metrics'], name: string): string | undefined {
    if (!metrics) { return undefined; }
    if (Array.isArray(metrics)) {
        const m = (metrics as { metric?: string; decimalValue?: { value?: string } }[])
            .find(x => x.metric === name);
        return m?.decimalValue?.value;
    }
    return (metrics as Record<string, { decimalValue?: { value?: string } }>)[name]?.decimalValue?.value;
}

/** A row's named metric as a percent (rate * 100), or undefined when absent/non-numeric. */
export function rowMetric(row: VitalsRow, name: string): number | undefined {
    const raw = rawMetricValue(row.metrics, name);
    if (!raw) { return undefined; }
    const val = parseFloat(raw);
    return isNaN(val) ? undefined : val * 100;
}

/** Latest (last row) value of a named metric, as a percent. */
export function latestMetric(data: VitalsQueryResponse | undefined, name: string): number | undefined {
    if (!data?.rows || data.rows.length === 0) { return undefined; }
    return rowMetric(data.rows[data.rows.length - 1], name);
}

/** Full daily series (oldest→newest, percent) of a named metric; rows missing it are dropped. */
export function metricSeries(data: VitalsQueryResponse | undefined, name: string): number[] | undefined {
    if (!data?.rows || data.rows.length === 0) { return undefined; }
    const series = data.rows.map(r => rowMetric(r, name)).filter((v): v is number => v !== undefined);
    return series.length > 0 ? series : undefined;
}
