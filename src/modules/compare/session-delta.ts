/**
 * "What changed?" session delta (cross-session-analysis idea #10).
 *
 * Computes how the just-ended session differs from its immediate predecessor, using only
 * already-persisted metadata — error/warning fingerprints, severity counts, and the `file:`
 * correlation tags. No file re-read, no new storage.
 *
 * Pure (no vscode import) so both the diff and its human-readable formatting are unit-testable
 * under `node --test`. The caller loads the two metadatas and routes the formatted summary to the
 * output channel.
 *
 * Scope note: raw output-volume delta (total lines) is intentionally omitted — SessionMeta does
 * not persist a per-session total line count, so it is not derivable here without re-reading both
 * log files, which this lightweight summary avoids.
 */

import type { SessionMeta } from '../session/session-metadata';

/** Prefix the correlation scanner uses for source-file tags (e.g. `file:lib/api_client.dart`). */
const FILE_TAG_PREFIX = 'file:';

/** The computed difference between a session and the one before it. */
export interface SessionDelta {
    /** False when there is no predecessor — the first session has nothing to compare against. */
    readonly hasPrevious: boolean;
    readonly errorCountDelta: number;
    readonly warningCountDelta: number;
    /** Example lines for error fingerprints present now but absent from the previous session. */
    readonly newErrors: readonly string[];
    /** Example lines for error fingerprints present in the previous session but gone now. */
    readonly resolvedErrors: readonly string[];
    /** Source files referenced this session that the previous session never mentioned. */
    readonly newSourceFiles: readonly string[];
    /** Environment fields that changed vs the previous session (idea #16), e.g. SDK/app version. */
    readonly environmentChanges: readonly EnvironmentChange[];
}

/** A single changed environment field, with both values for the "X → Y" summary. */
export interface EnvironmentChange {
    readonly label: string;
    readonly from: string;
    readonly to: string;
}

/** Hash set of a session's error fingerprints, skipping malformed entries. */
function errorHashes(meta: SessionMeta | undefined): Set<string> {
    const set = new Set<string>();
    for (const fp of meta?.fingerprints ?? []) {
        if (fp?.h) { set.add(fp.h); }
    }
    return set;
}

/** Map of error fingerprint hash → example line, for resolving examples after a set diff. */
function errorExamples(meta: SessionMeta | undefined): Map<string, string> {
    const map = new Map<string, string>();
    for (const fp of meta?.fingerprints ?? []) {
        if (fp?.h) { map.set(fp.h, fp.e || fp.n || fp.h); }
    }
    return map;
}

/** Source-file tags (the `file:`-prefixed correlation tags), prefix stripped. */
function sourceFiles(meta: SessionMeta | undefined): Set<string> {
    const set = new Set<string>();
    for (const tag of meta?.correlationTags ?? []) {
        if (tag.startsWith(FILE_TAG_PREFIX)) { set.add(tag.slice(FILE_TAG_PREFIX.length)); }
    }
    return set;
}

/** Environment fields compared between sessions — a change here (e.g. SDK version) is a prime
 *  suspect when an error appears in one session but not the other. */
const ENV_FIELDS: readonly { readonly key: 'appVersion' | 'debugAdapterType' | 'debugTarget'; readonly label: string }[] = [
    { key: 'appVersion', label: 'app version' },
    { key: 'debugAdapterType', label: 'debug adapter' },
    { key: 'debugTarget', label: 'target device' },
];

/** Diff the tracked environment fields between two sessions. Only fields present in both and
 *  differing are reported — a field newly populated (absent before) is not a "change". */
function environmentChanges(current: SessionMeta, previous: SessionMeta): EnvironmentChange[] {
    const out: EnvironmentChange[] = [];
    for (const { key, label } of ENV_FIELDS) {
        const from = previous[key];
        const to = current[key];
        if (from && to && from !== to) { out.push({ label, from, to }); }
    }
    return out;
}

/**
 * Diff the current session against its predecessor. With no predecessor, returns a zeroed delta
 * flagged `hasPrevious: false` so the caller can stay silent rather than reporting a non-comparison.
 */
export function computeSessionDelta(current: SessionMeta, previous: SessionMeta | undefined): SessionDelta {
    if (!previous) {
        return {
            hasPrevious: false,
            errorCountDelta: 0,
            warningCountDelta: 0,
            newErrors: [],
            resolvedErrors: [],
            newSourceFiles: [],
            environmentChanges: [],
        };
    }

    const curHashes = errorHashes(current);
    const prevHashes = errorHashes(previous);
    const curExamples = errorExamples(current);
    const prevExamples = errorExamples(previous);
    const curFiles = sourceFiles(current);
    const prevFiles = sourceFiles(previous);

    return {
        hasPrevious: true,
        errorCountDelta: (current.errorCount ?? 0) - (previous.errorCount ?? 0),
        warningCountDelta: (current.warningCount ?? 0) - (previous.warningCount ?? 0),
        newErrors: [...curHashes].filter((h) => !prevHashes.has(h)).map((h) => curExamples.get(h) ?? h),
        resolvedErrors: [...prevHashes].filter((h) => !curHashes.has(h)).map((h) => prevExamples.get(h) ?? h),
        newSourceFiles: [...curFiles].filter((f) => !prevFiles.has(f)),
        environmentChanges: environmentChanges(current, previous),
    };
}

/** True when the delta carries nothing worth reporting — caller should stay silent. */
export function isEmptyDelta(d: SessionDelta): boolean {
    return !d.hasPrevious
        || (d.errorCountDelta === 0
            && d.warningCountDelta === 0
            && d.newErrors.length === 0
            && d.resolvedErrors.length === 0
            && d.newSourceFiles.length === 0
            && d.environmentChanges.length === 0);
}

/** Render a signed count (e.g. `+3`, `-1`, `0`) for the summary line. */
function signed(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
}

/**
 * One-line-per-fact summary for the output channel. Returns an empty string for an empty delta so
 * the caller can decide not to log anything.
 */
export function formatSessionDelta(d: SessionDelta): string {
    if (isEmptyDelta(d)) { return ''; }
    const lines = ['Since last session:'];
    lines.push(`  errors ${signed(d.errorCountDelta)}, warnings ${signed(d.warningCountDelta)}`);
    if (d.newErrors.length > 0) { lines.push(`  ${d.newErrors.length} new error type(s): ${d.newErrors[0]}`); }
    if (d.resolvedErrors.length > 0) { lines.push(`  ${d.resolvedErrors.length} error type(s) no longer present`); }
    if (d.newSourceFiles.length > 0) { lines.push(`  new source files: ${d.newSourceFiles.slice(0, 5).join(', ')}`); }
    for (const e of d.environmentChanges) { lines.push(`  ${e.label}: ${e.from} → ${e.to}`); }
    return lines.join('\n');
}
