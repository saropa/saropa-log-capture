/** Type definitions for the Google Play Developer Reporting API v1beta1. */

/** A single metric value from the Vitals API. */
export interface VitalsMetricValue {
    readonly decimalValue?: { readonly value: string };
    readonly decimalValueConfidenceInterval?: {
        readonly lowerBound?: { readonly value: string };
        readonly upperBound?: { readonly value: string };
    };
}

/** A row in the Vitals API time-series response. */
export interface VitalsRow {
    readonly startTime?: { readonly year: number; readonly month: number; readonly day: number };
    readonly metrics?: Record<string, VitalsMetricValue>;
}

/** Response shape from crashRateMetricSet:query or anrRateMetricSet:query. */
export interface VitalsQueryResponse {
    readonly rows?: readonly VitalsRow[];
}

/** Parsed Vitals snapshot for display. */
export interface VitalsSnapshot {
    readonly crashRate?: number;
    readonly anrRate?: number;
    readonly queriedAt: number;
    readonly packageName: string;
}
