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
 *   [flowmap] enter <screen|tab|dialog|sheet> "<Name>" [back] [<lib/path/file.dart:line>]
 *
 * e.g.  [flowmap] enter dialog "Culture Picker" lib/components/.../culture_religion_picker_dialog.dart:101
 *
 * The optional `back` token (after the name, before the anchor) declares a back navigation — see
 * `TimelineEvent.back`. `back` sits before the source group so the `\S+\.dart` anchor never eats it.
 */
const FLOWMAP_TAG = /\[flowmap\]\s+enter\s+(screen|tab|dialog|sheet|inline)\s+"([^"]+)"(?:\s+(back))?(?:\s+(\S+\.dart):(\d+))?/i;

/**
 * Surface-close tag (bug 011) — the moment a surface is dismissed, so its dwell stops here instead
 * of running until the next `enter`. Without it, dismissing a dialog and sitting on the screen
 * behind it charges that idle time to the dialog. The kind is informational; the builder pops by name.
 *
 *   [flowmap] exit <screen|tab|dialog|sheet> "<Name>"
 */
const FLOWMAP_EXIT = /\[flowmap\]\s+exit\s+(screen|tab|dialog|sheet|inline)\s+"([^"]+)"/i;

/**
 * Return-navigation tag (plan 057) — a standalone verb, the form Saropa Contacts actually emits from
 * its `PopScope` back handler (`[flowmap] back tab "Home" …`). Identical to `enter` except the drawn
 * edge is a RETURN edge, so it produces the same `nav` event carrying `back: true`. Emitters send
 * `back` INSTEAD of `enter` (never both), keeping visit counts honest. Kept separate from the
 * `enter … back` flag form: the flag is an alternate spelling, this verb is what the app logs.
 *
 *   [flowmap] back <screen|tab|dialog|sheet|inline> "<Name>" [<lib/path/file.dart:line>]
 */
const FLOWMAP_BACK = /\[flowmap\]\s+back\s+(screen|tab|dialog|sheet|inline)\s+"([^"]+)"(?:\s+(\S+\.dart):(\d+))?/i;

const TAG_KIND: Record<string, NodeKind> = {
    screen: 'screen', tab: 'tab', dialog: 'dialog', sheet: 'dialog', inline: 'inline',
};

/**
 * Off-app handoff tag (bug 009) — the moment the user leaves the app for an external application or
 * the app makes an outbound API call. Parallel to `enter`; same source-anchor handling.
 *
 *   [flowmap] handoff <api|app> "<Name>" [<lib/path/file.dart:line>]
 *
 * e.g.  [flowmap] handoff app "Google Maps" lib/utils/lat_lng_map_utils.dart:42
 */
const FLOWMAP_HANDOFF = /\[flowmap\]\s+handoff\s+(api|app)\s+"([^"]+)"(?:\s+(\S+\.dart):(\d+))?/i;

/**
 * Explicit in-screen action tag (bug 010) — the third verb, parallel to `enter` and `handoff`.
 * Without it, per-node action counts only come from the contacts-shaped heuristic matchers below,
 * so any other project gets zero action data. The quoted string is both the display label and the
 * `actionCategory` counter key (matching how the heuristics set label = category).
 *
 *   [flowmap] action "<Category>" [<lib/path/file.dart:line>]
 *
 * e.g.  [flowmap] action "Favorite" lib/components/activity/activity_flag_button.dart:88
 */
const FLOWMAP_ACTION = /\[flowmap\]\s+action\s+"([^"]+)"(?:\s+(\S+\.dart):(\d+))?/i;

/** Parse a leading `./`-stripped `file.dart:line` anchor from a `[flowmap]` tag match, or undefined. */
function tagSource(file?: string, line?: string): SourceAnchor | undefined {
    return file ? { file: file.replace(/^\.\//, ''), line: parseInt(line ?? '', 10) } : undefined;
}

/** Parse a `[flowmap] enter …` project tag, or undefined. Carries the declared kind, back flag + source. */
function parseFlowMapTag(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_TAG.exec(line);
    if (!m) {
        return undefined;
    }
    // Groups: 1 kind, 2 name, 3 optional `back`, 4 anchor file, 5 anchor line.
    return {
        tsMs, clock, logLine, kind: 'nav',
        label: m[2].trim(), nodeKind: TAG_KIND[m[1].toLowerCase()],
        source: tagSource(m[4], m[5]), back: m[3] ? true : undefined,
    };
}

/** Parse a `[flowmap] exit …` tag, or undefined. Only the name is load-bearing (the builder pops by it). */
function parseFlowMapExit(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_EXIT.exec(line);
    if (!m) {
        return undefined;
    }
    return { tsMs, clock, logLine, kind: 'exit', label: m[2].trim(), nodeKind: TAG_KIND[m[1].toLowerCase()] };
}

/** Parse a `[flowmap] back …` verb, or undefined. Same `nav` event as `enter`, forced to a return edge. */
function parseFlowMapBack(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_BACK.exec(line);
    if (!m) {
        return undefined;
    }
    // Groups: 1 kind, 2 name, 3 anchor file, 4 anchor line. `back: true` is the only difference from enter.
    return {
        tsMs, clock, logLine, kind: 'nav',
        label: m[2].trim(), nodeKind: TAG_KIND[m[1].toLowerCase()],
        source: tagSource(m[3], m[4]), back: true,
    };
}

/**
 * Parse a `[flowmap] handoff …` tag, or undefined. The declared `api`/`app` type rides on
 * `actionCategory` so the renderer can distinguish the two; the node kind is always `external`.
 */
function parseFlowMapHandoff(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_HANDOFF.exec(line);
    if (!m) {
        return undefined;
    }
    return {
        tsMs, clock, logLine, kind: 'handoff', nodeKind: 'external',
        actionCategory: m[1].toLowerCase(), label: m[2].trim(), source: tagSource(m[3], m[4]),
    };
}

/**
 * Parse a `[flowmap] action …` tag, or undefined. The category rides on both `label` and
 * `actionCategory` so `applyAction` folds it into the current node's per-category counts.
 */
function parseFlowMapAction(line: string, tsMs: number, clock: string, logLine: number): TimelineEvent | undefined {
    const m = FLOWMAP_ACTION.exec(line);
    if (!m) {
        return undefined;
    }
    // The category is both the display label and the counter key — single trim, used twice.
    const category = m[1].trim();
    return {
        tsMs, clock, logLine, kind: 'action',
        label: category, actionCategory: category, source: tagSource(m[2], m[3]),
    };
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
    // Explicit project tags win — they carry the declared kind and source (most reliable).
    const tagged = parseFlowMapTag(line, tsMs, clock, logLine);
    if (tagged) {
        return tagged;
    }
    const exited = parseFlowMapExit(line, tsMs, clock, logLine);
    if (exited) {
        return exited;
    }
    const back = parseFlowMapBack(line, tsMs, clock, logLine);
    if (back) {
        return back;
    }
    const handoff = parseFlowMapHandoff(line, tsMs, clock, logLine);
    if (handoff) {
        return handoff;
    }
    const action = parseFlowMapAction(line, tsMs, clock, logLine);
    if (action) {
        return action;
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
