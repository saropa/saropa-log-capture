"use strict";
/**
 * Maps Drift Advisor snapshot JSON (extension API or `.saropa/drift-advisor-session.json`)
 * to Log Capture meta payload and sidecar JSON. Shape is best-effort against the
 * contract in plans/SAROPA_DRIFT_ADVISOR_INTEGRATION.md §4.3–4.5.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.countAnomaliesBySeverity = countAnomaliesBySeverity;
exports.snapshotToMetaPayload = snapshotToMetaPayload;
exports.snapshotToSidecarObject = snapshotToSidecarObject;
const drift_advisor_constants_1 = require("../drift-advisor-constants");
const MAX_TOP_SLOW = 10;
function num(v, d = 0) {
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
function str(v, d = '') {
    return typeof v === 'string' ? v : d;
}
/** Derive anomaly counts from an array of objects with optional `severity` string. */
function countAnomaliesBySeverity(anomalies) {
    let error = 0;
    let warning = 0;
    let info = 0;
    if (!Array.isArray(anomalies)) {
        return { count: 0, bySeverity: { error: 0, warning: 0, info: 0 } };
    }
    for (const a of anomalies) {
        if (!a || typeof a !== 'object') {
            continue;
        }
        const sev = str(a.severity).toLowerCase();
        if (sev === 'error' || sev === 'errors') {
            error++;
        }
        else if (sev === 'warning' || sev === 'warnings') {
            warning++;
        }
        else {
            info++;
        }
    }
    return {
        count: anomalies.length,
        bySeverity: { error, warning, info },
    };
}
function mapStringNumberRecord(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) {
        return {};
    }
    return Object.fromEntries(Object.entries(src).map(([k, v]) => [k, num(v, 0)]));
}
function parseIssuesSummary(raw) {
    const r = raw;
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
function buildTopSlow(perf) {
    const topSlowRaw = perf.topSlow;
    const topSlow = [];
    if (!Array.isArray(topSlowRaw)) {
        return topSlow;
    }
    for (const row of topSlowRaw) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        const r = row;
        topSlow.push({
            sql: str(r.sql ?? r.query, ''),
            durationMs: num(r.durationMs, 0),
            rowCount: typeof r.rowCount === 'number' ? r.rowCount : undefined,
            at: typeof r.at === 'string' ? r.at : undefined,
        });
        if (topSlow.length >= MAX_TOP_SLOW) {
            break;
        }
    }
    return topSlow;
}
function resolvedSchemaVersion(snap) {
    const sv = snap.schemaVersion;
    return typeof sv === 'number' && Number.isFinite(sv) ? sv : drift_advisor_constants_1.DRIFT_ADVISOR_CONTRACT_SCHEMA_VERSION;
}
/** Build meta.integrations['saropa-drift-advisor'] payload (without capturedAt/sessionWindow — registry adds those). */
function snapshotToMetaPayload(snap) {
    const perf = snap.performance && typeof snap.performance === 'object' ? snap.performance : {};
    const totalQueries = num(perf.totalQueries, num(perf.queryCount, 0));
    const totalDurationMs = num(perf.totalDurationMs, 0);
    const avgDurationMs = num(perf.avgDurationMs, totalQueries > 0 ? totalDurationMs / totalQueries : 0);
    const slowCount = num(perf.slowCount, 0);
    const topSlow = buildTopSlow(perf);
    const schema = snap.schemaSummary;
    const tableCount = schema && typeof schema.tableCount === 'number' ? schema.tableCount : 0;
    const tableNames = schema && Array.isArray(schema.tableNames)
        ? schema.tableNames.filter((x) => typeof x === 'string')
        : undefined;
    const health = snap.health;
    const anomalies = countAnomaliesBySeverity(snap.anomalies ?? undefined);
    const out = {
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
    out.schemaVersion = resolvedSchemaVersion(snap);
    return out;
}
/** Full sidecar object: snapshot spread + normalized generatedAt and schemaVersion. */
function snapshotToSidecarObject(snap) {
    const generatedAt = snap.generatedAt && typeof snap.generatedAt === 'string'
        ? snap.generatedAt
        : new Date().toISOString();
    return {
        ...snap,
        generatedAt,
        schemaVersion: resolvedSchemaVersion(snap),
    };
}
//# sourceMappingURL=drift-advisor-snapshot-map.js.map