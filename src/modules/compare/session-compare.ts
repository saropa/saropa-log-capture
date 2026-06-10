/**
 * N-way (3-way) session comparison engine (plan 031).
 *
 * The existing `diff-engine.ts` compares exactly two sessions. This module generalizes the
 * content-presence diff to three: a baseline A and two runs B and C. It answers "which lines are
 * unique to each run, which are shared, and — most useful for triage — which errors are NEW in B
 * or C versus the baseline, and which baseline errors are now gone."
 *
 * Pure and host-free (operates on already-read line arrays, not URIs) so it is fully unit-testable
 * and so the command layer owns all file IO. Normalization is shared with the 2-way engine via
 * `line-normalize.ts`, so a line judged equal here is judged equal there.
 */

import { normalizeLine } from '../misc/line-normalize';

/** Which of the three sessions a normalized line appears in. */
export type Presence = 'A' | 'B' | 'C' | 'AB' | 'AC' | 'BC' | 'ABC';

/** Input: three sessions' raw lines plus display labels (e.g. filenames). */
export interface ThreeWayInput {
    readonly labelA: string;
    readonly labelB: string;
    readonly labelC: string;
    readonly linesA: readonly string[];
    readonly linesB: readonly string[];
    readonly linesC: readonly string[];
    /**
     * Predicate deciding whether a (raw) line is an error. Injected so the engine stays pure and
     * the caller can pass the project's real level classifier; defaults to a conservative regex.
     */
    readonly isError?: (text: string) => boolean;
}

/** Per-presence line counts plus the error-delta summary that drives triage. */
export interface ThreeWaySummary {
    readonly counts: Readonly<Record<Presence, number>>;
    /** Distinct error lines present in B but not in baseline A ("B introduced these"). */
    readonly newErrorsB: readonly string[];
    /** Distinct error lines present in C but not in baseline A ("C introduced these"). */
    readonly newErrorsC: readonly string[];
    /** Distinct baseline-A error lines absent from BOTH B and C ("these look fixed"). */
    readonly resolvedErrors: readonly string[];
}

/** Full 3-way result: the per-presence buckets (representative raw text) and the summary. */
export interface ThreeWayResult {
    readonly labels: { readonly a: string; readonly b: string; readonly c: string };
    /** Representative raw lines per presence bucket, in first-seen order. */
    readonly buckets: Readonly<Record<Presence, readonly string[]>>;
    readonly summary: ThreeWaySummary;
}

const DEFAULT_IS_ERROR = (text: string): boolean =>
    /\b(error|exception|fatal|crash|panic|assert(?:ion)? failed)\b/i.test(text);

/** Build a map normalized-key -> first raw line seen, skipping blank/normalize-empty lines. */
function indexLines(lines: readonly string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const raw of lines) {
        const key = normalizeLine(raw);
        if (!key) { continue; }
        if (!map.has(key)) { map.set(key, raw); }
    }
    return map;
}

/** The presence code for a key given its membership in A/B/C. */
function presenceOf(inA: boolean, inB: boolean, inC: boolean): Presence {
    return ((inA ? 'A' : '') + (inB ? 'B' : '') + (inC ? 'C' : '')) as Presence;
}

/**
 * Compare three sessions by normalized line content. Alignment is by content membership (a line
 * is "the same" across sessions when it normalizes equal), not by index or timestamp — the MVP
 * the plan calls for. Each presence bucket keeps one representative raw line in first-seen order
 * (A then B then C), so the summary document can show real text, not normalized keys.
 */
export function compareThreeSessions(input: ThreeWayInput): ThreeWayResult {
    const isError = input.isError ?? DEFAULT_IS_ERROR;
    const a = indexLines(input.linesA);
    const b = indexLines(input.linesB);
    const c = indexLines(input.linesC);

    const allKeys = new Set<string>([...a.keys(), ...b.keys(), ...c.keys()]);
    const buckets: Record<Presence, string[]> = {
        A: [], B: [], C: [], AB: [], AC: [], BC: [], ABC: [],
    };

    // Iterate A, then B-only, then C-only additions to keep first-seen order stable and testable.
    const ordered: string[] = [
        ...a.keys(),
        ...[...b.keys()].filter(k => !a.has(k)),
        ...[...c.keys()].filter(k => !a.has(k) && !b.has(k)),
    ];
    for (const key of ordered) {
        if (!allKeys.has(key)) { continue; }
        const presence = presenceOf(a.has(key), b.has(key), c.has(key));
        const raw = a.get(key) ?? b.get(key) ?? c.get(key) ?? key;
        buckets[presence].push(raw);
    }

    return {
        labels: { a: input.labelA, b: input.labelB, c: input.labelC },
        buckets,
        summary: buildSummary(buckets, { a, b, c }, isError),
    };
}

/** The three normalized-key → raw-line indexes, grouped for the summary helper. */
interface SessionMaps {
    readonly a: Map<string, string>;
    readonly b: Map<string, string>;
    readonly c: Map<string, string>;
}

/** Compute counts + the error deltas (new in B/C vs A, resolved from A). */
function buildSummary(
    buckets: Record<Presence, string[]>,
    maps: SessionMaps,
    isError: (text: string) => boolean,
): ThreeWaySummary {
    const { a, b, c } = maps;
    const counts = {} as Record<Presence, number>;
    (Object.keys(buckets) as Presence[]).forEach(p => { counts[p] = buckets[p].length; });

    // New errors in a run = error lines present in that run but not in baseline A.
    const newErrorsIn = (run: Map<string, string>): string[] => {
        const out: string[] = [];
        for (const [key, raw] of run) {
            if (!a.has(key) && isError(raw)) { out.push(raw); }
        }
        return out;
    };
    // Resolved = baseline-A error lines absent from BOTH B and C.
    const resolvedErrors: string[] = [];
    for (const [key, raw] of a) {
        if (!b.has(key) && !c.has(key) && isError(raw)) { resolvedErrors.push(raw); }
    }

    return { counts, newErrorsB: newErrorsIn(b), newErrorsC: newErrorsIn(c), resolvedErrors };
}
