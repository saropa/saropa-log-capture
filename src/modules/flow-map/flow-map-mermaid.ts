/**
 * Renders a FlowGraph as a Mermaid `flowchart TD` block (plan 056, S1). The same node/edge model
 * feeds the future interactive panel (S2), so this file only concerns text rendering. Walked nodes
 * are solid; static-only nodes dashed; the crash node styled red — the possible-vs-walked overlay.
 */

import type { FlowEdge, FlowGraph, FlowNode } from './flow-map-model';
import { anchorText, formatActions, formatDwellMs } from './flow-map-format';

const CLASS_DEFS = [
    'classDef start fill:#2d333b,stroke:#888,color:#ddd;',
    'classDef walked fill:#1f3a2a,stroke:#3fb950,color:#e6edf3;',
    'classDef crash fill:#3a1a1a,stroke:#e05252,color:#ffd7d7;',
    'classDef unwalked fill:#22272e,stroke:#444,color:#666,stroke-dasharray:3 3;',
];

/** Escape characters Mermaid mis-parses inside a quoted label. */
function safeLabel(text: string): string {
    return text.replace(/"/g, "'").replace(/[[\]{}|]/g, '');
}

/** The CSS class for a node: crash > launch > walked > unwalked. */
function nodeClass(node: FlowNode): string {
    if (node.issues.some(i => i.severity === 'error')) { return 'crash'; }
    if (node.kind === 'launch') { return 'start'; }
    return node.walked ? 'walked' : 'unwalked';
}

/** Build the multi-line label for a node: name, counters, actions, source. */
function nodeLabel(node: FlowNode): string {
    const lines: string[] = [node.label];
    if (node.kind !== 'launch') {
        const dwell = node.walked ? ` · ${formatDwellMs(node.dwellMs)}` : '';
        lines.push(`×${node.visits}${dwell}`);
    }
    const actions = formatActions(node);
    if (actions) { lines.push(actions); }
    if (node.issues.some(i => i.severity === 'error')) { lines.push('💥 crash'); }
    const src = anchorText(node.source);
    if (src) { lines.push(src); }
    return safeLabel(lines.join('<br/>'));
}

/** Choose node bracket shape: launch is a stadium, everything else a box. */
function renderNode(id: string, node: FlowNode): string {
    const label = nodeLabel(node);
    const body = node.kind === 'launch' ? `(["${label}"])` : `["${label}"]`;
    return `  ${id}${body}:::${nodeClass(node)}`;
}

/** Render one edge; inferred edges are dotted with a note, walked solid, static-only dotted. */
function renderEdge(edge: FlowEdge, idOf: Map<string, string>): string | undefined {
    const from = idOf.get(edge.from);
    const to = idOf.get(edge.to);
    if (!from || !to) {
        return undefined;
    }
    const label = edge.count > 1 ? `|"×${edge.count}"|` : edge.inferred ? '|"opens"|' : '';
    const arrow = edge.walked ? '-->' : '-.->';
    return `  ${from} ${arrow}${label} ${to}`;
}

/** Render the full mermaid flowchart for a graph. */
export function renderMermaid(graph: FlowGraph): string {
    const idOf = new Map<string, string>();
    graph.nodes.forEach((n, i) => idOf.set(n.key, `n${i}`));

    const nodeLines = graph.nodes.map(n => renderNode(idOf.get(n.key) as string, n));
    const edgeLines = graph.edges
        .map(e => renderEdge(e, idOf))
        .filter((l): l is string => l !== undefined);

    return ['```mermaid', 'flowchart TD', ...nodeLines, ...edgeLines, ...CLASS_DEFS, '```'].join('\n');
}
