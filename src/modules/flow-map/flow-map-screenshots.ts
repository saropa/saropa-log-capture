/**
 * Joins captured screenshots (plan 114 sidecar) to the session flow map (plan 117, Phase E).
 *
 * Each `.screenshots.json` entry carries the 1-based log line it was captured at. The screen that
 * was on-screen at that moment is the LAST node-creating event ('nav'/'reached') whose `logLine` is
 * at or before the capture's `logLine` — walking the log forward, that event is the most recent
 * "the user is now looking at X" fact known before the capture fired. Pure data-in/data-out (no
 * vscode import) so this joins and renders without the Extension Host.
 */

import type { TimelineEvent } from './flow-map-model';

/**
 * Sidecar entry plus its already-encoded PNG data URI. The caller (host-side, async `vscode.workspace.fs`
 * reads) pairs each `.screenshots.json` entry with its data URI before calling `joinShotsToScreens` so
 * this module stays pure sync data-in/data-out.
 */
export interface ShotWithDataUri {
    readonly trigger: string;
    readonly timestamp: number;
    readonly logLine: number;
    readonly text: string;
    readonly dataUri: string;
}

/** One screenshot ready to render: sidecar metadata plus the screen it was captured on. */
export interface FlowShot {
    readonly dataUri: string;
    readonly clock: string;
    readonly trigger: string;
    readonly logLine: number;
    /** Display label of the screen active at capture time; undefined when none preceded it. */
    readonly screenLabel?: string;
    readonly text: string;
}

/** Kinds of `TimelineEvent` that create/enter a flow-map node (mirrors `flow-map-builder.ts`). */
const NODE_CREATING_KINDS: ReadonlySet<TimelineEvent['kind']> = new Set(['nav', 'reached']);

/** Format epoch-ms to a local HH:MM:SS clock string for the gallery caption. */
export function formatClock(epochMs: number): string {
    const d = new Date(epochMs);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The screen label active at `logLine`, or undefined when no node-creating event precedes it. */
function screenAt(logLine: number, events: readonly TimelineEvent[]): string | undefined {
    if (logLine <= 0) { return undefined; }
    let label: string | undefined;
    for (const event of events) {
        if (!NODE_CREATING_KINDS.has(event.kind)) { continue; }
        if (event.logLine === undefined || event.logLine > logLine) { continue; }
        label = event.label;
    }
    return label;
}

/**
 * Decorate sidecar entries (already paired with their data URI) with the screen active at capture
 * time — the last node-creating ('nav'/'reached') event at or before the entry's log line.
 */
export function joinShotsToScreens(
    entries: readonly ShotWithDataUri[],
    events: readonly TimelineEvent[],
): FlowShot[] {
    return entries.map(entry => ({
        dataUri: entry.dataUri,
        clock: formatClock(entry.timestamp),
        trigger: entry.trigger,
        logLine: entry.logLine,
        screenLabel: screenAt(entry.logLine, events),
        text: entry.text,
    }));
}
