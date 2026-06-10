/**
 * Classifies a single log line into a navigation/action TimelineEvent (Source 2 — runtime
 * breadcrumbs already in the stream). Patterns target the `[log]` analytics lines the contacts
 * app emits; they are best-effort and app-shaped (plan 056 calls these out as Source 2). Unmatched
 * lines return undefined and are ignored by the builder.
 */

import type { NodeKind, SourceAnchor, TimelineEvent } from './flow-map-model';

/**
 * Explicit project tag for complete, source-anchored capture (plan 056, #6). Apps emit one line per
 * screen/tab/dialog/sheet entered so the map captures EVERY surface (not just ones with ad-hoc
 * breadcrumbs) and gets the source file for free — including dialogs the screen scan can't resolve.
 *
 *   [flowmap] enter <screen|tab|dialog|sheet> "<Name>" [<lib/path/file.dart:line>]
 *
 * e.g.  [flowmap] enter dialog "Culture Picker" lib/components/.../culture_religion_picker_dialog.dart:101
 */
const FLOWMAP_TAG = /\[flowmap\]\s+enter\s+(screen|tab|dialog|sheet|inline)\s+"([^"]+)"(?:\s+(\S+\.dart):(\d+))?/i;

const TAG_KIND: Record<string, NodeKind> = {
    screen: 'screen', tab: 'tab', dialog: 'dialog', sheet: 'dialog', inline: 'inline',
};

/** Parse a `[flowmap] enter …` project tag, or undefined. Carries the declared kind + source. */
function parseFlowMapTag(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_TAG.exec(line);
    if (!m) {
        return undefined;
    }
    const source: SourceAnchor | undefined = m[3] ? { file: m[3].replace(/^\.\//, ''), line: parseInt(m[4], 10) } : undefined;
    return { tsMs, clock, logLine, kind: 'nav', label: m[2].trim(), nodeKind: TAG_KIND[m[1].toLowerCase()], source };
}

/** Strip the trailing `[sar-…uuid…]` and surrounding whitespace the app appends to breadcrumbs. */
function cleanLabel(raw: string): string {
    return raw.replace(/\[sar-[\w-]+\]\s*$/i, '').trim();
}

/** Extract the `[log] …` payload from a decorated log line, or undefined if not a log breadcrumb. */
function logPayload(line: string): string | undefined {
    const idx = line.indexOf('[log] ');
    return idx === -1 ? undefined : line.slice(idx + 6).trim();
}

/**
 * Ordered matchers. First hit wins. Each returns the event minus timing, which the caller stamps.
 * Kept as data so the set is easy to extend per app convention without touching control flow.
 */
const MATCHERS: { re: RegExp; build: (m: RegExpExecArray) => Omit<TimelineEvent, 'tsMs' | 'clock'> }[] = [
    // "Screen Navigation: Contact View" → primary node-creating nav.
    {
        re: /^Screen Navigation:\s*(.+)$/,
        build: (m) => ({ kind: 'nav', label: cleanLabel(m[1]) }),
    },
    // "Home Screen Reached: stream initialized" → reached the Home (tab) screen.
    {
        re: /^(.+?)\s+Screen Reached\b/,
        build: (m) => ({ kind: 'reached', label: cleanLabel(m[1]) }),
    },
    // "Activity flag made Favorite: James 'JT' Tait" → in-screen action, category = the flag.
    {
        re: /^Activity flag (?:made|removed)\s+(\w+)/,
        build: (m) => ({ kind: 'action', label: m[1], actionCategory: m[1] }),
    },
    // "Removed from Emergency Contacts: …" → Emergency action.
    {
        re: /^Removed from (\w+) Contacts\b/,
        build: (m) => ({ kind: 'action', label: m[1], actionCategory: m[1] }),
    },
    // "Viewed Connection Suggestion: …" → inline sub-view off the current screen.
    // Excludes "Viewed Contact Detail" (handled below as a viewed action, not a node).
    {
        re: /^Viewed (?!Contact Detail)(.+?):/,
        build: (m) => ({ kind: 'viewed', label: cleanLabel(m[1]) }),
    },
    // "Viewed Contact Detail: …" → a redundant nav signal (the matching "Screen Navigation" event
    // makes the Contact View node). Treated as lifecycle so it does NOT add a confusing "View" action
    // count alongside the visit count (#5).
    {
        re: /^Viewed Contact Detail\b/,
        build: () => ({ kind: 'lifecycle', label: 'Contact Detail' }),
    },
    // App lifecycle — used to explain repeated Home entries (hot restarts).
    {
        re: /^App (Startup|Shutdown)\b/,
        build: (m) => ({ kind: 'lifecycle', label: m[1] }),
    },
];

/** Classify a decorated log line into a TimelineEvent, or undefined when it is not a breadcrumb. */
export function classifyBreadcrumb(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    // Explicit project tag wins — it carries the declared kind and source (most reliable).
    const tagged = parseFlowMapTag(line, tsMs, clock, logLine);
    if (tagged) {
        return tagged;
    }
    const payload = logPayload(line);
    if (payload === undefined) {
        return undefined;
    }
    for (const { re, build } of MATCHERS) {
        const m = re.exec(payload);
        if (m) {
            return { tsMs, clock, logLine, ...build(m) };
        }
    }
    return undefined;
}
