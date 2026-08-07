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
// Type-only: erased at emit, so this module keeps its no-vscode-at-runtime property while the
// trigger stays tied to the capturer's real union instead of a bare string a rename could desync.
import type { ScreenshotTrigger } from '../screenshot/screenshot-store';
import { normalizeScreenKey } from './flow-map-format';

/**
 * Sidecar entry plus its already-encoded PNG data URI. The caller (host-side, async `vscode.workspace.fs`
 * reads) pairs each `.screenshots.json` entry with its data URI before calling `joinShotsToScreens` so
 * this module stays pure sync data-in/data-out.
 */
export interface ShotWithDataUri {
    readonly trigger: ScreenshotTrigger;
    readonly timestamp: number;
    readonly logLine: number;
    readonly text: string;
    readonly dataUri: string;
}

/** One screenshot ready to render: sidecar metadata plus the screen it was captured on. */
export interface FlowShot {
    readonly dataUri: string;
    readonly clock: string;
    readonly trigger: ScreenshotTrigger;
    readonly logLine: number;
    /** Display label of the screen active at capture time; undefined when none preceded it. */
    readonly screenLabel?: string;
    readonly text: string;
}

/**
 * Verdict for one capture against the report's embed budget. `skip` drops this capture but keeps
 * reading (a single capture too large to ever embed must not end the gallery); `stop` ends the walk
 * because the budget is spent.
 */
export type ShotBudgetVerdict = 'embed' | 'skip' | 'stop';

/**
 * Whether a capture fits the report's data-URI budget. Pure so the rule is testable without the
 * Extension Host — the caller does the file reads.
 *
 * A capture larger than the WHOLE budget is skipped rather than admitted as a special case: the adb
 * path alone allows a 32 MB PNG (~43 MB as base64), and shipping one because it happened to be first
 * would freeze the panel it is embedded in — precisely what the budget exists to prevent. Because
 * over-budget captures are skipped individually, `stop` can only be reached once something is already
 * embedded, so the gallery never comes back empty while a capture that fits was still available.
 */
export function shotBudgetVerdict(uriLength: number, bytesSoFar: number, maxBytes: number): ShotBudgetVerdict {
    if (uriLength > maxBytes) { return 'skip'; }
    if (bytesSoFar + uriLength > maxBytes) { return 'stop'; }
    return 'embed';
}

/** Kinds of `TimelineEvent` that create/enter a flow-map node (mirrors `flow-map-builder.ts`). */
const NODE_CREATING_KINDS: ReadonlySet<TimelineEvent['kind']> = new Set(['nav', 'reached']);

/**
 * Normalized screen identity for a display label. Delegates to the shared normalizer the builder's
 * `normalizeKey` also uses (R3) — the replay preview and the card thumbnails both pair gallery figures
 * (`data-screen-key`) to diagram nodes (`data-rowkey`) by exact string equality of this key, and a
 * private copy of the rule would let the two sides drift with no error to trace it by.
 */
export function screenKeyOf(label: string): string {
    return normalizeScreenKey(label);
}

/**
 * Format epoch-ms to a local HH:MM:SS clock string for the gallery caption.
 * Caveat: this is HOST-local time. Log line clocks are DEVICE-local ms-of-day, so when the device
 * sits in another timezone the caption clock will not match adjacent log clocks — the join itself
 * is unaffected (it anchors on log line numbers, never on clocks).
 */
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
