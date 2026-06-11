/**
 * Group a crash report's non-crash threads by identical stack signature (plan 054 Stage 5b).
 *
 * Why: a real Android crash dump carries dozens of threads, and most are identical waiting/native
 * threads (binder pools, OkHttp dispatchers, GC, finalizers) parked on the same frame. Listing each
 * one buries the few threads that actually differ. Collapsing threads whose frame sequence matches
 * into a single representative row with a `×N` count — the same idiom as the shipped repeated-frame
 * collapse — turns a 60-thread wall into a handful of distinct stacks.
 *
 * Pure data (no vscode dependency) so the grouping is unit-testable without the Extension Host.
 */

import type { CrashlyticsThread } from './crashlytics-types';

/** One set of threads that share an identical stack: a representative plus the collapsed count. */
export interface ThreadGroup {
    /** First-seen thread of the group — its frames stand in for the whole group. */
    readonly rep: CrashlyticsThread;
    /** How many threads share this exact stack (>=1). */
    readonly count: number;
    /** Every thread name in the group, in first-seen order (rep's name is `names[0]`). */
    readonly names: readonly string[];
}

/** A thread's identity for grouping: its frame texts joined. Name is intentionally ignored so that
 * `pool-1-thread-3` and `pool-1-thread-7` parked on the same stack collapse together. */
function threadSignature(thread: CrashlyticsThread): string {
    return thread.frames.map(f => f.text).join('\n');
}

/**
 * Collapse threads with identical stacks into counted groups, preserving first-seen order.
 *
 * Map iteration order is insertion order, so the returned groups keep the order threads first
 * appeared — the crash dump usually emits the most relevant threads first, so they stay on top.
 */
export function groupCrashThreads(threads: readonly CrashlyticsThread[]): ThreadGroup[] {
    const bySignature = new Map<string, { rep: CrashlyticsThread; names: string[] }>();
    for (const thread of threads) {
        const signature = threadSignature(thread);
        const existing = bySignature.get(signature);
        if (existing) {
            existing.names.push(thread.name);
        } else {
            bySignature.set(signature, { rep: thread, names: [thread.name] });
        }
    }
    return [...bySignature.values()].map(g => ({ rep: g.rep, count: g.names.length, names: g.names }));
}
