/**
 * Extract a compact signal summary from a root-cause hint bundle.
 *
 * Pure function: takes a bundle + hypotheses, returns a PersistedSignalSummaryV1
 * suitable for saving to SessionMeta. Returns undefined if the bundle contains
 * no meaningful signal data (all counts zero, no hypotheses).
 */

import type { RootCauseHintBundle, RootCauseHypothesis } from './root-cause-hint-types';
import {
    SIGNAL_SUMMARY_SCHEMA_VERSION_V2,
    type PersistedSignalSummaryV2, type PersistedSignalEntryV2, type SignalSummaryCounts,
} from './signal-summary-types';
// Re-export V2 as the default summary type for callers
export type { PersistedSignalSummaryV2 };

const maxTemplateIds = 5;
const maxNPlusOneFingerprints = 3;
const maxSlowOps = 3;

/** Build counts object from bundle signal arrays. */
function buildCounts(bundle: RootCauseHintBundle): SignalSummaryCounts {
    return {
        errors: bundle.errors?.length,
        sqlBursts: bundle.sqlBursts?.length,
        nPlusOneHints: bundle.nPlusOneHints?.length,
        warningGroups: bundle.warningGroups?.length,
        networkFailures: bundle.networkFailures?.length,
        memoryEvents: bundle.memoryEvents?.length,
        slowOperations: bundle.slowOperations?.length,
        permissionDenials: bundle.permissionDenials?.length,
        classifiedErrors: bundle.classifiedErrors?.length,
    };
}

/** True if every count is zero or undefined — nothing worth persisting. */
function isEmptyCounts(counts: SignalSummaryCounts): boolean {
    return Object.values(counts).every(v => !v);
}

/** Extract top N+1 fingerprints sorted by repeat count (descending). */
function extractTopNPlusOneFingerprints(bundle: RootCauseHintBundle): string[] | undefined {
    const hints = bundle.nPlusOneHints;
    if (!hints || hints.length === 0) { return undefined; }
    // Deduplicate by fingerprint, keeping the highest repeat count per fingerprint
    const byFp = new Map<string, number>();
    for (const h of hints) {
        const existing = byFp.get(h.fingerprint) ?? 0;
        if (h.repeats > existing) { byFp.set(h.fingerprint, h.repeats); }
    }
    return [...byFp.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxNPlusOneFingerprints)
        .map(([fp]) => fp);
}

/** Extract top slow operation names sorted by duration (descending). */
function extractTopSlowOps(bundle: RootCauseHintBundle): string[] | undefined {
    const ops = bundle.slowOperations;
    if (!ops || ops.length === 0) { return undefined; }
    // Only include named operations (PERF lines with operationName)
    const named = ops.filter((o): o is typeof o & { operationName: string } => typeof o.operationName === 'string');
    if (named.length === 0) { return undefined; }
    // Deduplicate by name, keeping the highest duration per name
    const byName = new Map<string, number>();
    for (const o of named) {
        const existing = byName.get(o.operationName) ?? 0;
        if (o.durationMs > existing) { byName.set(o.operationName, o.durationMs); }
    }
    return [...byName.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxSlowOps)
        .map(([name]) => name);
}

const maxEntries = 20;

/** Extract V2 entries for signal types that only store counts in V1 (network, memory, slow ops, etc.). */
function extractEntries(bundle: RootCauseHintBundle): PersistedSignalEntryV2[] | undefined {
    const entries: PersistedSignalEntryV2[] = [];
    for (const nf of bundle.networkFailures ?? []) {
        const label = nf.excerpt.slice(0, 120) || 'Network failure';
        entries.push({ kind: 'network', fingerprint: nf.pattern, label, count: 1 });
    }
    for (const me of bundle.memoryEvents ?? []) {
        const label = me.excerpt.slice(0, 120) || 'Memory event';
        entries.push({ kind: 'memory', fingerprint: label, label, count: 1 });
    }
    for (const so of bundle.slowOperations ?? []) {
        const name = so.operationName ?? so.excerpt.slice(0, 80);
        entries.push({ kind: 'slow-op', fingerprint: name, label: name, count: 1, avgDurationMs: so.durationMs, maxDurationMs: so.durationMs });
    }
    for (const pd of bundle.permissionDenials ?? []) {
        const label = pd.excerpt.slice(0, 120) || 'Permission denied';
        entries.push({ kind: 'permission', fingerprint: label, label, count: 1 });
    }
    for (const ce of bundle.classifiedErrors ?? []) {
        const label = ce.excerpt.slice(0, 120) || 'Classified error';
        entries.push({ kind: 'classified', fingerprint: label, label, category: ce.classification, count: 1 });
    }
    return entries.length > 0 ? entries.slice(0, maxEntries) : undefined;
}

/**
 * Extract a compact signal summary (V2) from a root-cause hint bundle and its hypotheses.
 * V2 includes actual entries for count-only signal types. Returns undefined if no meaningful data.
 */
export function extractSignalSummary(
    bundle: RootCauseHintBundle,
    hypotheses: readonly RootCauseHypothesis[],
): PersistedSignalSummaryV2 | undefined {
    const counts = buildCounts(bundle);
    const anrRiskLevel = bundle.anrRisk?.level;
    const templateIds = hypotheses.length > 0
        ? [...new Set(hypotheses.map(h => h.templateId))].slice(0, maxTemplateIds)
        : undefined;

    // Nothing meaningful to persist — skip the metadata write entirely
    if (isEmptyCounts(counts) && !anrRiskLevel && !templateIds) { return undefined; }

    return {
        schemaVersion: SIGNAL_SUMMARY_SCHEMA_VERSION_V2,
        counts,
        anrRiskLevel,
        hypothesisTemplateIds: templateIds,
        topNPlusOneFingerprints: extractTopNPlusOneFingerprints(bundle),
        topSlowOps: extractTopSlowOps(bundle),
        entries: extractEntries(bundle),
    };
}
