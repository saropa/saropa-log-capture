/**
 * Post-walk attachment: turning each crash into its own dialog node + inferred edge, and window-
 * matching non-crash issues (errors/perf) onto the node that was active when they fired (R4/R5).
 * Split out of `flow-map-builder.ts` once the walk itself plus this attachment pass pushed that file
 * past the 300-line house limit — the two are sequential PHASES of one build (see `buildGraph`), not
 * independent features, so they stay siblings rather than each growing its own abstraction.
 */

import { ensureNode, type BuildState } from './flow-map-builder';
import { normalizeScreenKey } from './flow-map-format';
import type { CrashInfo, FlowNode, IssueEvent, SourceAnchor } from './flow-map-model';

/**
 * This phase only ever reads/writes the build's nodes, edges and occupancy record — never
 * `navStack`/`enteredAtMs`, which belong solely to the walk that already finished by the time this
 * runs. Narrower than `BuildState` on purpose: it makes it a type error for this module to reach
 * into walk-only state it has no business touching, rather than relying on nobody happening to.
 */
type AttachmentState = Pick<BuildState, 'nodes' | 'edges' | 'segments' | 'currentKey' | 'scan'>;

/**
 * Compile-time proof that the guarantee above actually holds, not just an assertion in a comment.
 * `_WalkOnlyLeak` is `never` only while `AttachmentState` excludes both walk-only fields; if a
 * future edit widens the `Pick` to re-admit either one, this line stops compiling — the same
 * failure mode `tsc --noEmit` already catches on every `npm run check-types` run, so the leak this
 * type exists to prevent cannot land silently.
 */
type _WalkOnlyLeak = Extract<keyof AttachmentState, 'navStack' | 'enteredAtMs'>;
const _assertNoWalkOnlyLeak: _WalkOnlyLeak extends never ? true : never = true;

/**
 * The screen a crash's inferred edge should hang off: whoever was ACTUALLY current at the crash
 * time, read from the closed occupancy segments. Node dwell windows can't answer this — a node
 * revisited twice has one window spanning the gap where the user was elsewhere, so a crash in that
 * gap would window-match the wrong screen. The LAST containing segment wins (nested stays: the
 * caller's segment re-opens after an exit, so the latest entry is the innermost active surface).
 */
function crashFromKey(state: AttachmentState, tsMs: number): string | undefined {
    let found: string | undefined;
    for (const seg of state.segments) {
        if (tsMs >= seg.start && tsMs <= seg.end) { found = seg.key; }
    }
    return found ?? state.currentKey;
}

/** Turn `culture_religion_picker_dialog` into `Culture Religion Picker Dialog`. */
function prettyDialogName(base: string): string {
    return base.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Build the crash issue row attached to the crash node. */
function crashIssueRow(tsMs: number, clock: string, message: string, source?: SourceAnchor): IssueEvent {
    return { tsMs, clock, severity: 'error', category: 'Crash', detail: message, source };
}

/** Create one crash's node + inferred edge and attach its crash issue (R4/R5). */
function applyCrash(state: AttachmentState, crash: CrashInfo): void {
    const base = crash.source?.file.split('/').pop()?.replace(/\.dart$/, '') ?? crash.widget ?? 'Crash';
    const key = normalizeScreenKey(`crash:${base}`);
    const node = ensureNode(state, key, prettyDialogName(base), 'dialog');
    node.visits++;
    node.walked = true;
    node.resolved = Boolean(crash.source);
    node.source = crash.source ?? node.source;
    node.firstTsMs ??= crash.tsMs;
    node.logLine ??= crash.logLine;
    const fromKey = crashFromKey(state, crash.tsMs);
    if (fromKey && fromKey !== key) {
        const id = `${fromKey}\0${key}`;
        const existing = state.edges.get(id);
        if (existing) { existing.count++; }
        else { state.edges.set(id, { from: fromKey, to: key, count: 1, walked: true, inferred: true }); }
    }
    node.issues.push(crashIssueRow(crash.tsMs, crash.clock, crash.message, crash.source));
}

/** Create every crash's node + inferred edge (R4/R5). */
export function applyCrashes(state: AttachmentState, crashes: readonly CrashInfo[]): void {
    for (const crash of crashes) { applyCrash(state, crash); }
}

/** True when a node's dwell window (open-ended if never left) contains the timestamp. */
function issueWithin(node: FlowNode, tsMs: number): boolean {
    return node.firstTsMs !== undefined
        && tsMs >= node.firstTsMs
        && (node.lastTsMs === undefined || tsMs <= node.lastTsMs);
}

/**
 * Pick the node an issue badges. Explicit `[flowmap] error` tags name a real moment, so they attach
 * to the surface actually current then — the INNERMOST open node (greatest firstTsMs among containing
 * windows), dialogs included. After an `exit`, a revealed caller's window re-extends over the span
 * its dialog was up, so the two windows overlap; first-match-by-insertion would wrongly hand the error
 * to the outer screen. Heuristic issues keep the old rule: first containing non-dialog node (which
 * keeps window-matched noise off the synthetic crash node).
 */
function targetNodeForIssue(state: AttachmentState, issue: IssueEvent): FlowNode | undefined {
    if (issue.explicit) {
        let best: FlowNode | undefined;
        for (const node of state.nodes.values()) {
            if (issueWithin(node, issue.tsMs) && (!best || (node.firstTsMs ?? 0) > (best.firstTsMs ?? 0))) {
                best = node;
            }
        }
        return best;
    }
    for (const node of state.nodes.values()) {
        if (issueWithin(node, issue.tsMs) && node.kind !== 'dialog') {
            return node;
        }
    }
    return undefined;
}

/** Attach window-matched issues (errors/perf) to the node active when they fired (R4). */
export function attachIssues(state: AttachmentState, issues: readonly IssueEvent[]): void {
    for (const issue of issues) {
        // The crash is already placed on its own dialog node by applyCrash; skip it here so it does
        // not also flag the screen that was merely active at crash time (false "💥 crash" badge).
        if (issue.tsMs <= 0 || issue.severity === 'info' || issue.category === 'Crash') {
            continue;
        }
        targetNodeForIssue(state, issue)?.issues.push(issue);
    }
}
