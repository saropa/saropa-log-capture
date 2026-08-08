/**
 * Folds a ParsedLog (runtime) over an optional static-scan index (Source 3) into a FlowGraph,
 * applying the plan-056 design rules:
 *   R1 forward-only, de-duplicated edges (back/pop suppressed)
 *   R2 re-entry increments a node counter, never a self-loop
 *   R3 nodes keyed by normalized label
 *   R4 issue overlay attached by dwell window
 *   R5/R6 source anchors + source-derived labels from the scan index / crash report
 */

import type {
    FlowEdge, FlowGraph, FlowNode, NodeKind, ParsedLog, SourceAnchor, TimelineEvent,
} from './flow-map-model';
import { normalizeScreenKey } from './flow-map-format';
import { applyCrashes, attachIssues } from './flow-map-builder-issues';

/** Static-scan output: normalized screen label → { source, displayLabel }. */
export type ScanIndex = Map<string, { source: SourceAnchor; label: string }>;

/**
 * R3 — normalize a label to a stable identity key. Delegates to the shared normalizer: the screenshot
 * join keys captures with the SAME function, and the diagram pairs a card to its thumbnail by exact
 * equality of the two results, so a second copy of this rule here could drift them apart silently.
 */
const normalizeKey = normalizeScreenKey;

/** Map a breadcrumb kind to a node kind. */
function kindFor(event: TimelineEvent): NodeKind {
    if (event.kind === 'reached') { return 'tab'; }
    if (event.kind === 'viewed') { return 'inline'; }
    return 'screen';
}

/**
 * Mutable build state for the single ordered pass over events. Exported so the crash/issue
 * attachment pass (`flow-map-builder-issues.ts`), which runs immediately after the walk in
 * `buildGraph`, can read and extend the same state rather than the walk handing back a narrower
 * shape the second phase would have to re-derive.
 */
export interface BuildState {
    readonly nodes: Map<string, FlowNode>;
    readonly edges: Map<string, FlowEdge>;
    /**
     * The chain of screens currently "open" (entered, not yet returned past). Navigating to a key
     * already on this stack is a return to that ancestor — the screens above it were closed. The
     * stack recovers returns of ANY depth (A→B→C then back to A), not just an immediate A→B→A pop,
     * which a single `prevKey` could not detect.
     */
    readonly navStack: string[];
    readonly scan?: ScanIndex;
    /**
     * Closed occupancy segments: one {key, start, end} per completed stay on a currentable node.
     * Node dwell windows (firstTsMs/lastTsMs) span ALL visits including the gaps between them, so a
     * crash in a gap would window-match the wrong screen; segments record who was ACTUALLY current.
     */
    readonly segments: { key: string; start: number; end: number }[];
    currentKey?: string;
    enteredAtMs?: number;
}

/** Get or create a node, joining to the static scan index for label/source (R5/R6). */
export function ensureNode(state: BuildState, key: string, label: string, kind: NodeKind): FlowNode {
    const existing = state.nodes.get(key);
    if (existing) {
        return existing;
    }
    const hit = state.scan?.get(key);
    const node: FlowNode = {
        key,
        label: hit?.label ?? label,
        kind,
        visits: 0,
        dwellMs: 0,
        actionCounts: {},
        issues: [],
        source: hit?.source,
        walked: false,
        resolved: Boolean(hit),
    };
    state.nodes.set(key, node);
    return node;
}

/** Add dwell time to the node the user is leaving and record when it was left. */
function leaveCurrent(state: BuildState, atMs: number): void {
    if (state.currentKey === undefined || state.enteredAtMs === undefined) {
        return;
    }
    const node = state.nodes.get(state.currentKey);
    if (node) {
        node.dwellMs += Math.max(0, atMs - state.enteredAtMs);
        node.lastTsMs = atMs;
    }
    // Close this stay's occupancy segment — the precise record crashFromKey anchors against.
    state.segments.push({ key: state.currentKey, start: state.enteredAtMs, end: atMs });
}

/** Record (or increment) a plain forward transition edge. Back/return edges are handled by recordTransition. */
function recordEdge(state: BuildState, toKey: string, dwellMs: number): void {
    const from = state.currentKey;
    if (from === undefined || from === toKey) {
        return; // self or pop — suppressed
    }
    const id = `${from}\0${toKey}`;
    const edge = state.edges.get(id);
    if (edge) {
        edge.count++;
        edge.dwellMs = (edge.dwellMs ?? 0) + dwellMs;
    } else {
        state.edges.set(id, { from, to: toKey, count: 1, dwellMs, walked: true });
    }
}

/**
 * Decide a transition's edge and update the open-screen stack. A target already on the stack below
 * the top is a return to that ancestor — emit a distinct `back` edge (deduped by count) and pop the
 * surfaces closed on the way back. Otherwise it is a forward step: record the forward edge and push.
 * Back edges use a `back ` id prefix so a return never collides with a genuine forward edge.
 */
function recordTransition(state: BuildState, toKey: string, forceBack: boolean, dwellMs: number): void {
    const from = state.currentKey;
    if (from === undefined || from === toKey) {
        return;
    }
    // A target already open below the top is a return to that ancestor. An explicit `back` flag forces
    // the same treatment even when the stack didn't detect it — the app's back handler is authoritative.
    // lastIndexOf (not indexOf): when a key sits on the stack twice, pop to the NEAREST occurrence —
    // popping to the first occurrence would close every surface between two genuine forward visits.
    const stackIdx = state.navStack.lastIndexOf(toKey);
    const isReturn = forceBack || (stackIdx >= 0 && stackIdx < state.navStack.length - 1);
    if (isReturn) {
        const id = `back ${from} ${toKey}`;
        const existing = state.edges.get(id);
        if (existing) {
            existing.count++;
            existing.dwellMs = (existing.dwellMs ?? 0) + dwellMs;
        } else {
            state.edges.set(id, { from, to: toKey, count: 1, dwellMs, walked: true, back: true });
        }
        // Only pop when the target is actually on the stack; a forced back to a non-open surface still
        // draws the return edge but has no ancestors to close.
        if (stackIdx >= 0) { state.navStack.length = stackIdx + 1; }
        return;
    }
    recordEdge(state, toKey, dwellMs);
    state.navStack.push(toKey);
}

/** Apply one node-creating event: visit count, edge, dwell handoff (R1/R2). */
function applyTransition(state: BuildState, event: TimelineEvent): void {
    const key = normalizeKey(event.label);
    // An explicit [flowmap] tag declares the kind (dialog/tab/…) and source; honor both (#6).
    const node = ensureNode(state, key, event.label, event.nodeKind ?? kindFor(event));
    node.visits++;
    node.walked = true;
    node.firstTsMs ??= event.tsMs;
    node.logLine ??= event.logLine;
    node.source ??= event.source;
    if (key !== state.currentKey) {
        // Time on the source screen before THIS departure — the honest per-transition edge label.
        const dwellBefore = state.enteredAtMs !== undefined ? Math.max(0, event.tsMs - state.enteredAtMs) : 0;
        recordTransition(state, key, event.back === true, dwellBefore);
        leaveCurrent(state, event.tsMs);
        state.currentKey = key;
        state.enteredAtMs = event.tsMs;
    }
}

/**
 * A mid-session `App Startup` (hot restart): the app re-launched, so the open-surface stack is gone.
 * Close the current node's dwell, hand `current` back to the synthetic launch node, and count the
 * extra launch visit — repeated Home entries get an explanation instead of looking like user taps.
 */
function applyRestart(state: BuildState, event: TimelineEvent): void {
    if (state.currentKey === undefined) {
        return; // initial startup before any navigation — seedLaunch will handle it
    }
    leaveCurrent(state, event.tsMs);
    const launch = state.nodes.get('app launch');
    if (launch) { launch.visits++; }
    state.navStack.length = 1; // keep only the launch node seeded at [0]
    state.currentKey = 'app launch';
    state.enteredAtMs = event.tsMs;
}

/**
 * Apply a `[flowmap] exit` (bug 011): close the current surface's dwell at the exit moment and hand
 * `current` back to the revealed caller, which resumes accruing from here. Without this, a dismissed
 * dialog keeps accruing until the next `enter`, stealing the caller's idle time. An exit that does
 * not name the current surface is ignored so a stray tag can't rewind onto the wrong screen.
 */
function applyExit(state: BuildState, event: TimelineEvent): void {
    const key = normalizeKey(event.label);
    if (state.currentKey !== key) {
        return;
    }
    leaveCurrent(state, event.tsMs);
    const idx = state.navStack.lastIndexOf(key);
    // navStack[0] is the synthetic launch node — never pop it (idx > 0 guard).
    if (idx > 0) {
        state.navStack.length = idx;
    }
    state.currentKey = state.navStack[state.navStack.length - 1];
    state.enteredAtMs = event.tsMs;
}

/**
 * Add a leaf node + edge off the current screen WITHOUT making it current — so the real screen keeps
 * accruing dwell and remains the anchor for the next transition (e.g. the crash). Without this,
 * "Viewed Connection Suggestion" would steal the 34-minute idle and the crash edge from Contact View.
 * Shared by inline sub-views (applyBranch) and off-app handoffs (applyHandoff).
 */
function applyLeaf(state: BuildState, event: TimelineEvent, kind: NodeKind, label: string): void {
    if (state.currentKey === undefined) {
        return;
    }
    const key = normalizeKey(label);
    if (key === state.currentKey) {
        return;
    }
    const node = ensureNode(state, key, label, kind);
    node.visits++;
    node.walked = true;
    node.firstTsMs ??= event.tsMs;
    node.logLine ??= event.logLine;
    node.source ??= event.source;
    const id = `${state.currentKey} ${key}`;
    const edge = state.edges.get(id);
    if (edge) {
        edge.count++;
    } else {
        state.edges.set(id, { from: state.currentKey, to: key, count: 1, walked: true });
    }
}

/** An inline "viewed" sub-view: a leaf branch off the current screen, kind `inline`. */
function applyBranch(state: BuildState, event: TimelineEvent): void {
    applyLeaf(state, event, 'inline', event.label);
}

/**
 * An off-app handoff (bug 009): a leaf branch off the current screen, kind `external`. The app is
 * backgrounded and the return is not reliably logged, so the external node must stay a leaf (never
 * current) for the same reason inline views do. The `api` type is prefixed into the label so an
 * outbound API call reads distinctly from a launched app even though both share the external style.
 */
function applyHandoff(state: BuildState, event: TimelineEvent): void {
    const label = event.actionCategory === 'api' ? `api: ${event.label}` : event.label;
    applyLeaf(state, event, event.nodeKind ?? 'external', label);
}

/** Attribute an in-screen action to whichever node is current (R4 for actions). */
function applyAction(state: BuildState, event: TimelineEvent): void {
    if (state.currentKey === undefined) {
        return;
    }
    const node = state.nodes.get(state.currentKey);
    const category = event.actionCategory ?? 'Action';
    if (node) {
        node.actionCounts[category] = (node.actionCounts[category] ?? 0) + 1;
    }
}

/** Prepend the synthetic launch node and seed it as current. */
function seedLaunch(state: BuildState, atMs: number): void {
    const launch = ensureNode(state, 'app launch', 'App Launch', 'launch');
    launch.visits = 1;
    launch.walked = true;
    launch.firstTsMs = atMs;
    state.currentKey = 'app launch';
    state.navStack.push('app launch');
    state.enteredAtMs = atMs;
}

/** Build the flow graph from a parsed log and optional static-scan index. */
export function buildGraph(parsed: ParsedLog, scan?: ScanIndex): FlowGraph {
    const state: BuildState = { nodes: new Map(), edges: new Map(), navStack: [], segments: [], scan };
    const transitionEvents = new Set(['nav', 'reached']);

    for (const event of parsed.events) {
        if (state.currentKey === undefined && transitionEvents.has(event.kind)) {
            seedLaunch(state, event.tsMs);
        }
        if (transitionEvents.has(event.kind)) {
            applyTransition(state, event);
        } else if (event.kind === 'viewed') {
            applyBranch(state, event);
        } else if (event.kind === 'handoff') {
            // A handoff is a leaf side-exit, NOT a transition: it must not become current or seed the
            // launch node, or it would steal the screen's dwell and the next transition's edge.
            applyHandoff(state, event);
        } else if (event.kind === 'action') {
            applyAction(state, event);
        } else if (event.kind === 'exit') {
            applyExit(state, event);
        } else if (event.kind === 'lifecycle' && event.label === 'Startup') {
            applyRestart(state, event);
        }
    }

    // The session can keep running after a caught exception, so the dwell close-out must cover the
    // later of the last breadcrumb and the last crash — not just the first crash.
    const lastCrashMs = parsed.crashes.reduce((max, c) => Math.max(max, c.tsMs), 0);
    const endMs = Math.max(lastCrashMs, lastEventMs(parsed.events));
    leaveCurrent(state, endMs);
    applyCrashes(state, parsed.crashes);
    attachIssues(state, parsed.issues);

    return { nodes: [...state.nodes.values()], edges: [...state.edges.values()] };
}

/** Timestamp of the last event, used to close the final node's dwell window. */
function lastEventMs(events: readonly TimelineEvent[]): number {
    return events.length > 0 ? events[events.length - 1].tsMs : 0;
}
