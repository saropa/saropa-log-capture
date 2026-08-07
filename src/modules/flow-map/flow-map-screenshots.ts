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
 * Sidecar entry plus the URL its PNG will render from. The caller (host-side) resolves each
 * `.screenshots.json` entry to a URL before calling `joinShotsToScreens` so this module stays pure
 * sync data-in/data-out.
 */
export interface ShotWithSource {
    readonly trigger: ScreenshotTrigger;
    readonly timestamp: number;
    readonly logLine: number;
    readonly text: string;
    readonly src: string;
    readonly path: string;
}

/** One screenshot ready to render: sidecar metadata plus the screen it was captured on. */
export interface FlowShot {
    /**
     * Image URL. Two-stage by design: the loader puts the PNG's `file:` URI here, and the panel
     * rewrites it to `webview.asWebviewUri(...)` immediately before render, because only a live
     * `Webview` can mint a URL its own sandbox will load. Render modules just emit the string.
     */
    readonly src: string;
    /**
     * Absolute on-disk path of the PNG, shown and copyable in the lightbox. Distinct from `src`:
     * that one is a URL the sandbox can fetch, this one is what the reader pastes into a terminal or
     * a bug report, so it must survive the webview rewrite unchanged.
     */
    readonly path: string;
    readonly clock: string;
    readonly trigger: ScreenshotTrigger;
    readonly logLine: number;
    /** Display label of the screen active at capture time; undefined when none preceded it. */
    readonly screenLabel?: string;
    readonly text: string;
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
 * Decorate sidecar entries (already paired with their image URL) with the screen active at capture
 * time — the last node-creating ('nav'/'reached') event at or before the entry's log line.
 */
export function joinShotsToScreens(
    entries: readonly ShotWithSource[],
    events: readonly TimelineEvent[],
): FlowShot[] {
    return entries.map(entry => ({
        src: entry.src,
        path: entry.path,
        clock: formatClock(entry.timestamp),
        trigger: entry.trigger,
        logLine: entry.logLine,
        screenLabel: screenAt(entry.logLine, events),
        text: entry.text,
    }));
}
