/**
 * Maps Drift Advisor snapshot JSON (extension API or `.saropa/drift-advisor-session.json`)
 * to Log Capture meta payload and sidecar JSON. Shape is best-effort against the
 * contract in plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md §4.3–4.5.
 */

/** Loose snapshot shape from Drift Advisor `getSessionSnapshot()` or session file. */
export interface DriftAdvisorSnapshotLike {
    readonly baseUrl?: string;
    readonly performance?: Record<string, unknown> | null;
    readonly anomalies?: readonly unknown[] | null;
    readonly schemaSummary?: { readonly tableCount?: number; readonly tableNames?: readonly string[] } | null;
    readonly health?: { readonly ok?: boolean; readonly extensionConnected?: boolean } | null;
    readonly indexSuggestionsCount?: number;
    readonly issuesSummary?: Record<string, unknown>;
    readonly issues?: readonly unknown[];
    readonly generatedAt?: string;
}

export interface DriftAdvisorMetaPayloadOut {
    baseUrl: string;
    performance: {
        totalQueries: number;
        totalDurationMs: number;
        avgDurationMs: number;
        slowCount: number;
        topSlow: Array<{ sql: string; durationMs: number; rowCount?: number; at?: string }>;
    };
    anomalies: {
        count: number;
        bySeverity: { error: number; warning: number; info: number };
    };
    schema: { tableCount: number; tableNames?: string[] };
    health: { ok: boolean; extensionConnected?: boolean };
    indexSuggestionsCount?: number;
    issuesSummary?: {
        count: number;
        byCode: Record<string, number>;
        bySeverity: Record<string, number>;
    };
}

const MAX_TOP_SLOW = 10;

function num(v: unknown, d = 0): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function str(v: unknown, d = ''): string {
    return typeof v === 'string' ? v : d;
}

/** Derive anomaly counts from an array of objects with optional `severity` string. */
export function countAnomaliesBySeverity(anomalies: readonly unknown[] | null | undefined): {
    count: number;
    bySeverity: { error: number; warning: number; info: number };
} {
    let error = 0;
    let warning = 0;
    let info = 0;
    if (!Array.isArray(anomalies)) {
        return { count: 0, bySeverity: { error: 0, warning: 0, info: 0 } };
    }
    for (const a of anomalies) {
        if (!a || typeof a !== 'object') { continue; }
        const sev = str((a as Record<string, unknown>).severity).toLowerCase();
        if (sev === 'error' || sev === 'errors') { error++; }
        else if (sev === 'warning' || sev === 'warnings') { warning++; }
        else { info++; }
    }
    return {
        count: anomalies.length,
        bySeverity: { error, warning, info },
    };
}

function mapStringNumberRecord(src: unknown): Record<string, number> {
    if (!src || typeof src !== 'object' || Array.isArray(src)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(src as Record<string, unknown>).map(([k, v]) => [k, num(v, 0)]),
    );
}

function parseIssuesSummary(
    raw: object,
): DriftAdvisorMetaPayloadOut['issuesSummary'] | undefined {
    const r = raw as Record<string, unknown>;
    const count = num(r.count, 0);
    const byCode = r.byCode;
    const bySeverity = r.bySeverity;
    if (count <= 0 && (!byCode || typeof byCode !== 'object') && (!bySeverity || typeof bySeverity !== 'object')) {
        return undefined;
    }
    return {
        count,
        byCode: mapStringNumberRecord(byCode),
        bySeverity: mapStringNumberRecord(bySeverity),
    };
}

function buildTopSlow(perf: Record<string, unknown>): Array<{ sql: string; durationMs: number; rowCount?: number; at?: string }> {
    const topSlowRaw = perf.topSlow;
    const topSlow: Array<{ sql: string; durationMs: number; rowCount?: number; at?: string }> = [];
    if (!Array.isArray(topSlowRaw)) {
        return topSlow;
    }
    for (const row of topSlowRaw) {
        if (!row || typeof row !== 'object') { continue; }
        const r = row as Record<string, unknown>;
        topSlow.push({
            sql: str(r.sql ?? r.query, ''),
            durationMs: num(r.durationMs, 0),
            rowCount: typeof r.rowCount === 'number' ? r.rowCount : undefined,
            at: typeof r.at === 'string' ? r.at : undefined,
        });
        if (topSlow.length >= MAX_TOP_SLOW) { break; }
    }
    return topSlow;
}

/** Build meta.integrations['saropa-drift-advisor'] payload (without capturedAt/sessionWindow — registry adds those). */
export function snapshotToMetaPayload(snap: DriftAdvisorSnapshotLike): DriftAdvisorMetaPayloadOut {
    const perf = snap.performance && typeof snap.performance === 'object' ? snap.performance : {};
    const totalQueries = num(perf.totalQueries, num(perf.queryCount, 0));
    const totalDurationMs = num(perf.totalDurationMs, 0);
    const avgDurationMs = num(perf.avgDurationMs, totalQueries > 0 ? totalDurationMs / totalQueries : 0);
    const slowCount = num(perf.slowCount, 0);
    const topSlow = buildTopSlow(perf);

    const schema = snap.schemaSummary;
    const tableCount = schema && typeof schema.tableCount === 'number' ? schema.tableCount : 0;
    const tableNames = schema && Array.isArray(schema.tableNames)
        ? schema.tableNames.filter((x): x is string => typeof x === 'string')
        : undefined;

    const health = snap.health;
    const anomalies = countAnomaliesBySeverity(snap.anomalies ?? undefined);

    const out: DriftAdvisorMetaPayloadOut = {
        baseUrl: str(snap.baseUrl, ''),
        performance: {
            totalQueries,
            totalDurationMs,
            avgDurationMs,
            slowCount,
            topSlow,
        },
        anomalies,
        schema: { tableCount, ...(tableNames && tableNames.length > 0 ? { tableNames } : {}) },
        health: {
            ok: health?.ok === true,
            ...(typeof health?.extensionConnected === 'boolean' ? { extensionConnected: health.extensionConnected } : {}),
        },
    };

    if (typeof snap.indexSuggestionsCount === 'number') {
        out.indexSuggestionsCount = snap.indexSuggestionsCount;
    }

    const issuesRaw = snap.issuesSummary;
    if (issuesRaw !== null && typeof issuesRaw === 'object' && !Array.isArray(issuesRaw)) {
        const issuesSummary = parseIssuesSummary(issuesRaw);
        if (issuesSummary) {
            out.issuesSummary = issuesSummary;
        }
    }

    return out;
}

/** Full sidecar object: snapshot spread + normalized generatedAt. */
export function snapshotToSidecarObject(snap: DriftAdvisorSnapshotLike): Record<string, unknown> {
    const generatedAt = snap.generatedAt && typeof snap.generatedAt === 'string'
        ? snap.generatedAt
        : new Date().toISOString();
    return {
        ...snap,
        generatedAt,
    };
}
