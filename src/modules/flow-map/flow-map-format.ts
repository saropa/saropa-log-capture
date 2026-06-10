/**
 * Shared formatting helpers for the flow-map mermaid diagram and the markdown report.
 * Kept separate so the diagram and the tables render dwell/actions/anchors identically.
 */

import type { FlowNode, SourceAnchor } from './flow-map-model';

// Flutter debug output is ANSI-colored when allowAnsiColorOutput is set; codes must be stripped or
// they render as `□[32m…`. Defined here (the shared format module) so the parser strips at ingest
// AND the render layer strips again as a belt-and-suspenders guard against any unstripped field.
const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Remove ANSI/CSI escape sequences from a string. */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_RE, '');
}

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

/** Compact source anchor for a diagram node: `basename:line` (full path lives in the table). */
export function anchorBasename(source?: SourceAnchor): string {
    if (!source) {
        return '';
    }
    const base = source.file.split('/').pop() ?? source.file;
    return source.line ? `${base}:${source.line}` : base;
}

/** True when the node carries an error-severity issue (drives crash styling). */
export function nodeHasError(node: FlowNode): boolean {
    return node.issues.some(i => i.severity === 'error');
}

/** Per-kind glyph prefixed to a node's title in the diagram, for at-a-glance type recognition. */
export function kindIcon(node: FlowNode): string {
    if (nodeHasError(node)) { return '💥'; }
    switch (node.kind) {
        case 'launch': return '🚀';
        case 'tab': return '🗂️';
        case 'screen': return '📄';
        case 'dialog': return '🪟';
        case 'inline': return '🔎';
        default: return '•';
    }
}

/**
 * The display lines for a node: name, optional visit/dwell counter, action summary, crash flag,
 * compact source. The SVG passes `withCounter: false` because it shows visits as a corner badge and
 * dwell on the edges; the Mermaid export keeps the inline counter (it has no badges/edge labels).
 */
export function nodeDisplayLines(node: FlowNode, withCounter = true): string[] {
    const lines: string[] = [node.label];
    if (withCounter && node.kind !== 'launch') {
        const dwell = node.walked ? ` · ${formatDwellMs(node.dwellMs)}` : '';
        lines.push(`×${node.visits}${dwell}`);
    }
    const actions = formatActions(node);
    if (actions) {
        lines.push(actions);
    }
    if (nodeHasError(node)) {
        lines.push('💥 crash');
    }
    const src = anchorBasename(node.source);
    if (src) {
        lines.push(src);
    }
    // Defensive: strip any ANSI that slipped through ingest so the diagram never shows `□[32m…`.
    return lines.map(stripAnsi);
}

/** The clock at which a node was first entered, for the dwell table. */
export function enteredClock(node: FlowNode, clockOf: (tsMs: number) => string): string {
    return node.firstTsMs !== undefined ? clockOf(node.firstTsMs) : '';
}
