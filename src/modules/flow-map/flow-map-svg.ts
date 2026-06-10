/**
 * Renders a FlowGraph as a self-contained SVG (plan 056, S2 first cut). Hand-rolled so the native
 * webview needs no Mermaid/dagre dependency and works offline. Sessions produce small, near-linear
 * graphs, so a simple longest-path layered (top-down) layout reads cleanly. The same node text as
 * the Mermaid export is reused via nodeDisplayLines so the webview and the saved .md agree.
 */

import type { FlowEdge, FlowGraph, FlowNode } from './flow-map-model';
import { formatDwellMs, kindIcon, nodeDisplayLines, nodeHasError } from './flow-map-format';

const BOX_W = 236;
const LINE_H = 17;
const PAD_Y = 13;
const ROW_GAP = 54;
const COL_GAP = 36;
const MARGIN = 26;

interface Palette { readonly fill: string; readonly stroke: string; readonly text: string; readonly dashed: boolean; }

/** Color a node by class — matches the Mermaid classDefs so both diagrams look the same. */
function paletteOf(node: FlowNode): Palette {
    if (nodeHasError(node)) { return { fill: '#3a1a1a', stroke: '#e05252', text: '#ffd7d7', dashed: false }; }
    if (node.kind === 'launch') { return { fill: '#2d333b', stroke: '#8b949e', text: '#e6edf3', dashed: false }; }
    // External handoffs are walked but get a distinct purple dashed leaf style (bug 009) — checked
    // before the walked branch so they don't fall through to the solid green screen style.
    if (node.kind === 'external') { return { fill: '#2b2440', stroke: '#a371f7', text: '#e6e0ff', dashed: true }; }
    if (node.walked) { return { fill: '#16321f', stroke: '#3fb950', text: '#e6edf3', dashed: false }; }
    return { fill: '#22272e', stroke: '#555', text: '#9aa4ad', dashed: true };
}

/** Escape text for XML/SVG. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Truncate a node line so it fits the box width. */
function clip(line: string): string {
    return line.length > 30 ? line.slice(0, 29) + '…' : line;
}

/** Longest-path depth per node (DAG; R1 keeps edges forward so no cycles). */
function computeDepths(graph: FlowGraph): Map<string, number> {
    const depth = new Map<string, number>();
    graph.nodes.forEach(n => depth.set(n.key, 0));
    for (let pass = 0; pass < graph.nodes.length; pass++) {
        let changed = false;
        for (const e of graph.edges) {
            const d = (depth.get(e.from) ?? 0) + 1;
            if (d > (depth.get(e.to) ?? 0)) { depth.set(e.to, d); changed = true; }
        }
        if (!changed) { break; }
    }
    return depth;
}

interface Placed { readonly node: FlowNode; readonly lines: string[]; x: number; y: number; readonly w: number; readonly h: number; }

/** Group nodes into rows by depth, preserving insertion order within a row. */
function rowsByDepth(graph: FlowGraph, depth: Map<string, number>): FlowNode[][] {
    const rows: FlowNode[][] = [];
    for (const node of graph.nodes) {
        const d = depth.get(node.key) ?? 0;
        (rows[d] ??= []).push(node);
    }
    return rows.filter(Boolean);
}

/** Position every node; returns placements + the overall canvas size. */
function layout(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number } {
    const rows = rowsByDepth(graph, computeDepths(graph));
    const built = rows.map(row => row.map(node => {
        const raw = nodeDisplayLines(node, false);
        raw[0] = `${kindIcon(node)} ${raw[0]}`;
        const lines = raw.map(clip);
        return { node, lines, x: 0, y: 0, w: BOX_W, h: PAD_Y * 2 + lines.length * LINE_H };
    }));
    const maxWidth = Math.max(...built.map(r => r.length * BOX_W + (r.length - 1) * COL_GAP), BOX_W);
    const placed = new Map<string, Placed>();
    let y = MARGIN;
    for (const row of built) {
        const rowWidth = row.length * BOX_W + (row.length - 1) * COL_GAP;
        let x = MARGIN + (maxWidth - rowWidth) / 2;
        const rowHeight = Math.max(...row.map(p => p.h));
        for (const p of row) {
            p.x = x;
            p.y = y;
            placed.set(p.node.key, p);
            x += BOX_W + COL_GAP;
        }
        y += rowHeight + ROW_GAP;
    }
    return { placed, width: maxWidth + MARGIN * 2, height: y - ROW_GAP + MARGIN };
}

/** The table row key a node cross-links to: crash nodes target the crash issue row. */
function rowKeyOf(node: FlowNode): string {
    return nodeHasError(node) ? 'crash' : node.key;
}

/** Render one node as an interactive group: box + stacked text lines, tagged for cross-highlight. */
function renderNode(p: Placed): string {
    const pal = paletteOf(p.node);
    const dash = pal.dashed ? ' stroke-dasharray="4 3"' : '';
    const cx = p.x + p.w / 2;
    const tspans = p.lines.map((line, i) => {
        const isTitle = i === 0;
        const weight = isTitle ? ' font-weight="700"' : '';
        const size = isTitle ? 13.5 : 11.5;
        const fill = isTitle ? pal.text : '#aeb6bf';
        const dy = isTitle ? PAD_Y + 13 : LINE_H;
        return `<tspan x="${cx}" dy="${dy}" font-size="${size}" fill="${fill}"${weight}>${esc(line)}</tspan>`;
    }).join('');
    const cls = nodeHasError(p.node) ? 'fm-node fm-crash' : 'fm-node';
    const logAttr = p.node.logLine ? ` data-logline="${p.node.logLine}"` : '';
    return `<g class="${cls}" data-rowkey="${esc(rowKeyOf(p.node))}"${logAttr} tabindex="0" role="button">`
        + `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" `
        + `fill="${pal.fill}" stroke="${pal.stroke}" stroke-width="1.5"${dash}/>`
        + `<text x="${cx}" y="${p.y}" text-anchor="middle" fill="${pal.text}" `
        + `font-family="var(--vscode-font-family)">${tspans}</text>${visitBadge(p, pal)}</g>`;
}

/** A circular visit-count badge straddling the node's top-right corner (e.g. ②). Walked, non-launch. */
function visitBadge(p: Placed, pal: Palette): string {
    if (p.node.kind === 'launch' || !p.node.walked || p.node.visits < 1) {
        return '';
    }
    const cx = p.x + p.w;
    const cy = p.y;
    return `<circle cx="${cx}" cy="${cy}" r="11" fill="${pal.stroke}" stroke="#0d1117" stroke-width="2"/>`
        + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#0d1117" `
        + `font-size="11" font-weight="700" font-family="var(--vscode-font-family)">${p.node.visits}</text>`;
}

/** The edge label: dwell on the source node (time before this transition), plus count / "opens". */
function edgeLabel(edge: FlowEdge, from: Placed): string {
    const parts: string[] = [];
    // Dwell is meaningful leaving a real screen, not the synthetic launch node.
    if (from.node.kind !== 'launch' && from.node.dwellMs >= 1000) {
        parts.push(formatDwellMs(from.node.dwellMs));
    }
    if (edge.count > 1) { parts.push(`×${edge.count}`); }
    if (edge.inferred) { parts.push('opens'); }
    return parts.join(' · ');
}

/** Render one edge: a line from the source's bottom to the target's top, with the dwell/count label. */
function renderEdge(edge: FlowEdge, placed: Map<string, Placed>): string {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) { return ''; }
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const dash = edge.walked ? '' : ' stroke-dasharray="5 4"';
    const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8b949e" `
        + `stroke-width="1.5"${dash} marker-end="url(#fm-arrow)"/>`;
    const label = edgeLabel(edge, from);
    if (!label) { return line; }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return line + `<text x="${mx}" y="${my}" text-anchor="middle" fill="#c9d1d9" font-size="11" `
        + `font-family="var(--vscode-font-family)" paint-order="stroke" stroke="#1c2128" `
        + `stroke-width="3">${esc(label)}</text>`;
}

/** Render the whole graph as an `<svg>` element string. */
export function renderSvg(graph: FlowGraph): string {
    const { placed, width, height } = layout(graph);
    const defs = '<defs><marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        + 'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8b949e"/></marker></defs>';
    const edges = graph.edges.map(e => renderEdge(e, placed)).join('');
    const nodes = [...placed.values()].map(renderNode).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" `
        + `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Session flow diagram">`
        + `${defs}${edges}${nodes}</svg>`;
}
