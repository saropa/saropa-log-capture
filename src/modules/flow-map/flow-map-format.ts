/**
 * Shared formatting helpers for the flow-map mermaid diagram and the markdown report.
 * Kept separate so the diagram and the tables render dwell/actions/anchors identically.
 */

import type { FlowNode, SourceAnchor } from './flow-map-model';

/** Human dwell string: "brief" (<1s), "Ns" (<1min), else "~Nm". */
export function formatDwellMs(ms: number): string {
    if (ms < 1000) {
        return 'brief';
    }
    if (ms < 60_000) {
        return `${Math.round(ms / 1000)}s`;
    }
    const mins = ms / 60_000;
    const secs = Math.round((ms % 60_000) / 1000);
    return mins < 2 && secs > 0 ? `~${Math.floor(mins)}m${secs}s` : `~${Math.round(mins)}m`;
}

/** Summarize a node's categorized actions: "6 Favorite, 2 Emergency". Empty when none. */
export function formatActions(node: FlowNode): string {
    const parts = Object.entries(node.actionCounts)
        .filter(([, n]) => n > 0)
        .map(([cat, n]) => `${n} ${cat}`);
    return parts.join(', ');
}

/** Render a source anchor as `file:line` (line optional). Empty string when absent. */
export function anchorText(source?: SourceAnchor): string {
    if (!source) {
        return '';
    }
    return source.line ? `${source.file}:${source.line}` : source.file;
}

/** The clock at which a node was first entered, for the dwell table. */
export function enteredClock(node: FlowNode, clockOf: (tsMs: number) => string): string {
    return node.firstTsMs !== undefined ? clockOf(node.firstTsMs) : '';
}
