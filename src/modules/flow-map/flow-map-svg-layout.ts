/**
 * Row planning for the flow diagram — which nodes share a row, and which nodes leave the walk
 * entirely. Split out of `flow-map-svg.ts` (which owns pixel placement) and kept pure so the shape
 * decisions can be unit-tested without measuring anything.
 *
 * Two rules keep a four-step session from rendering 1272px wide:
 *
 * 1. **Terminal fault nodes leave the walk.** A crash node with nothing after it is an annotation on
 *    the screen it happened on, not a step the user took. Five of them at the same depth used to sit
 *    side by side in one row and set the canvas width on their own. They now stack in a column beside
 *    the walk (see `faultLeaves`).
 * 2. **Genuinely wide sibling sets wrap.** Any remaining row over `MAX_ROW_CARDS` splits into stacked
 *    sub-rows of near-equal size, so a screen that really did open six children costs height rather
 *    than width.
 */

import type { FlowGraph, FlowNode } from './flow-map-model';
import { nodeHasError } from './flow-map-format';

/**
 * Cards per row before a row wraps. Three portrait cards plus their gaps sit near the width of a
 * comfortably-sized panel; beyond that the reader is scrolling sideways to follow one step.
 */
export const MAX_ROW_CARDS = 3;

/** The planned shape of a diagram: walk rows top-down, plus the fault nodes hanging off them. */
export interface RowPlan {
    /** Main walk rows in depth order, already wrapped to `MAX_ROW_CARDS`. */
    readonly rows: readonly (readonly FlowNode[])[];
    /** Terminal fault nodes keyed by the node key they hang off, in graph order. */
    readonly faultLeaves: ReadonlyMap<string, readonly FlowNode[]>;
}

/** Longest-path depth per node (DAG; R1 keeps edges forward so no cycles). */
export function computeDepths(graph: FlowGraph): Map<string, number> {
    const depth = new Map<string, number>();
    graph.nodes.forEach(n => depth.set(n.key, 0));
    for (let pass = 0; pass < graph.nodes.length; pass++) {
        let changed = false;
        for (const e of graph.edges) {
            // Back edges close cycles (B returns to ancestor A); skipping them keeps longest-path
            // layering a DAG so depths can't run away and rows stay top-down.
            if (e.back) { continue; }
            const d = (depth.get(e.from) ?? 0) + 1;
            if (d > (depth.get(e.to) ?? 0)) { depth.set(e.to, d); changed = true; }
        }
        if (!changed) { break; }
    }
    return depth;
}

/**
 * Split one depth-row into stacked sub-rows of near-equal size. Near-equal rather than greedy
 * chunking so four siblings read as 2+2 instead of a full row and a lonely straggler.
 */
function wrapRow(row: readonly FlowNode[]): FlowNode[][] {
    if (row.length <= MAX_ROW_CARDS) { return [[...row]]; }
    const parts = Math.ceil(row.length / MAX_ROW_CARDS);
    const size = Math.ceil(row.length / parts);
    const out: FlowNode[][] = [];
    for (let i = 0; i < row.length; i += size) { out.push(row.slice(i, i + size)); }
    return out;
}

/**
 * The key each terminal fault node hangs off: the source of its first incoming forward edge.
 * Undefined when nothing points at it — an orphan fault node has no parent to sit beside, so it
 * stays in the walk rather than floating in the fault column with no edge explaining it.
 */
function parentKeyOf(graph: FlowGraph, key: string): string | undefined {
    return graph.edges.find(e => !e.back && e.to === key)?.from;
}

/**
 * Node keys that have at least one outgoing forward edge — i.e. the walk continued past them.
 * A back edge does not count: returning to an ancestor is not "the session went on from here".
 */
function keysWithSuccessors(graph: FlowGraph): ReadonlySet<string> {
    return new Set(graph.edges.filter(e => !e.back).map(e => e.from));
}

/**
 * Plan the diagram's rows: pull terminal fault nodes out of the walk into per-parent stacks, then
 * lay the remaining nodes out by longest-path depth with wide rows wrapped.
 */
export function planRows(graph: FlowGraph): RowPlan {
    const hasSuccessor = keysWithSuccessors(graph);
    const faultLeaves = new Map<string, FlowNode[]>();
    const walk: FlowNode[] = [];
    for (const node of graph.nodes) {
        const parent = nodeHasError(node) && !hasSuccessor.has(node.key)
            ? parentKeyOf(graph, node.key)
            : undefined;
        if (parent === undefined) { walk.push(node); continue; }
        const list = faultLeaves.get(parent);
        if (list) { list.push(node); } else { faultLeaves.set(parent, [node]); }
    }
    // Depths come from the FULL graph so a node's depth never shifts just because a fault leaf below
    // it moved out — the walk's own layering must not depend on what was pulled aside.
    const depth = computeDepths(graph);
    const byDepth: FlowNode[][] = [];
    for (const node of walk) { (byDepth[depth.get(node.key) ?? 0] ??= []).push(node); }
    return { rows: byDepth.filter(Boolean).flatMap(wrapRow), faultLeaves };
}
