/**
 * Renders a FlowGraph as a Mermaid `flowchart TD` block (plan 056, S1). The same node/edge model
 * feeds the future interactive panel (S2), so this file only concerns text rendering. Walked nodes
 * are solid; static-only nodes dashed; the crash node styled red — the possible-vs-walked overlay.
 */

import type { FlowEdge, FlowGraph, FlowNode } from './flow-map-model';
import { kindIcon, nodeDisplayLines, nodeHasError } from './flow-map-format';

const CLASS_DEFS = [
    'classDef start fill:#2d333b,stroke:#888,color:#ddd;',
    'classDef walked fill:#1f3a2a,stroke:#3fb950,color:#e6edf3;',
    'classDef crash fill:#3a1a1a,stroke:#e05252,color:#ffd7d7;',
    'classDef external fill:#2b2440,stroke:#a371f7,color:#e6e0ff,stroke-dasharray:4 3;',
    'classDef unwalked fill:#22272e,stroke:#444,color:#666,stroke-dasharray:3 3;',
];

/** Escape characters Mermaid mis-parses inside a quoted label. */
function safeLabel(text: string): string {
    return text.replace(/"/g, "'").replace(/[[\]{}|]/g, '');
}

/** The CSS class for a node: crash > launch > external > walked > unwalked. */
function nodeClass(node: FlowNode): string {
    if (nodeHasError(node)) { return 'crash'; }
    if (node.kind === 'launch') { return 'start'; }
    // External handoffs are walked, so they must be classed before the walked fall-through to keep
    // their distinct dashed leaf style instead of the solid green screen style (bug 009).
    if (node.kind === 'external') { return 'external'; }
    return node.walked ? 'walked' : 'unwalked';
}

/** Build the multi-line label for a node: kind icon + name, counters, actions, source. */
function nodeLabel(node: FlowNode): string {
    const lines = nodeDisplayLines(node);
    lines[0] = `${kindIcon(node)} ${lines[0]}`;
    return safeLabel(lines.join('<br/>'));
}

/** Choose node bracket shape: launch is a stadium, external a parallelogram (off-app leaf), else a box. */
function renderNode(id: string, node: FlowNode): string {
    const label = nodeLabel(node);
    let body = `["${label}"]`;
    if (node.kind === 'launch') {
        body = `(["${label}"])`;
    } else if (node.kind === 'external') {
        body = `[/"${label}"/]`;
    }
    return `  ${id}${body}:::${nodeClass(node)}`;
}

/** Render one edge; back returns are dotted with a ↩, inferred dotted "opens", walked solid. */
function renderEdge(edge: FlowEdge, idOf: Map<string, string>): string | undefined {
    const from = idOf.get(edge.from);
    const to = idOf.get(edge.to);
    if (!from || !to) {
        return undefined;
    }
    // A return-to-caller edge reads as "↩" (with ×N when repeated) and is dotted so it never looks
    // like another forward step in the top-down chart.
    if (edge.back) {
        return `  ${from} -.->|"${edge.count > 1 ? `↩ ×${edge.count}` : '↩'}"| ${to}`;
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
