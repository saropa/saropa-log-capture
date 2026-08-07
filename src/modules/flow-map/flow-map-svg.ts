/**
 * Renders a FlowGraph as a self-contained SVG (plan 056, S2 first cut). Hand-rolled so the native
 * webview needs no Mermaid/dagre dependency and works offline. Sessions produce small, near-linear
 * graphs, so a simple longest-path layered (top-down) layout reads cleanly. The same node text as
 * the Mermaid export is reused via nodeDisplayLines so the webview and the saved .md agree.
 *
 * This module owns PIXELS. Which nodes share a row, and which nodes leave the walk for the fault
 * column, is decided by `flow-map-svg-layout.ts` — see its header for why a four-step session used
 * to render 1272px wide.
 */

import type { FlowEdge, FlowGraph, FlowNode } from './flow-map-model';
import type { FlowShot } from './flow-map-screenshots';
import { formatDwellMs, kindIcon, nodeDisplayLines, nodeHasError } from './flow-map-format';
import { groupShotsByScreen, THUMB_BLOCK_H, thumbMarkup, type ShotsByScreen } from './flow-map-svg-shots';
import { planRows } from './flow-map-svg-layout';

/**
 * Portrait card width. Nodes are storyboard cards (tall, phone-shaped) rather than the original 236px
 * landscape boxes so a captured screenshot can sit ON the node at a recognizable size; the narrower
 * card also lets more sibling screens share a row before the diagram runs wide.
 */
const BOX_W = 168;
const LINE_H = 17;
const PAD_Y = 13;
const ROW_GAP = 54;
const COL_GAP = 36;
const MARGIN = 26;
/** Gap from an edge's midpoint to its dwell label, kept to the right of the shaft so it stays legible. */
const EDGE_LABEL_GAP = 8;
/** How far a back (return) edge bows to the right of the boxes so it clears the forward arrow. */
const BACK_BULGE = 22;
/** Extra bulge per additional back edge so overlapping return curves fan out instead of stacking. */
const BACK_STAGGER = 14;
/** Vertical gap between stacked cards in the terminal-fault side column (see `flow-map-svg-layout`). */
const FAULT_GAP = 14;
/**
 * Roughly how many fault cards may stack before the column wraps. Expressed in CARDS, not pixels, so
 * the bound tracks card geometry instead of drifting the next time a card's height changes — a raw
 * pixel constant silently means "ten cards" today and "six cards" after a text-budget edit.
 *
 * Roughly, because the bound is a canvas y and a stack starts below its PARENT, not at the margin:
 * a fault hanging off a deep row fits fewer cards than one hanging off the first. That is the right
 * trade — the bound exists to stop runaway height, not to guarantee an exact card count.
 */
const FAULT_COL_CARDS = 10;
/**
 * Minimum height a fault card occupies: no thumbnail, and the fewest lines `nodeDisplayLines` ever
 * produces for a crash node (title + one detail). Used only to convert `FAULT_COL_CARDS` into a
 * height bound — real cards are measured, this is the conversion factor.
 */
const FAULT_CARD_MIN_H = PAD_Y * 2 + LINE_H * 2 + FAULT_GAP;

interface Palette { readonly cls: string; readonly dashed: boolean; }

/**
 * Palette CLASS for a node — actual colors live in the panel stylesheet as semantic-token rules
 * (`.fm-p-walked rect { … }`), so the diagram tracks the host light/dark theme instead of the old
 * baked dark-only hex fills. The Mermaid export keeps its own static colors (it leaves VS Code).
 */
function paletteOf(node: FlowNode): Palette {
    if (nodeHasError(node)) { return { cls: 'fm-p-crash', dashed: false }; }
    if (node.kind === 'launch') { return { cls: 'fm-p-launch', dashed: false }; }
    // External handoffs are walked but get a distinct dashed leaf style (bug 009) — checked before
    // the walked branch so they don't fall through to the solid walked-screen style.
    if (node.kind === 'external') { return { cls: 'fm-p-external', dashed: true }; }
    if (node.walked) { return { cls: 'fm-p-walked', dashed: false }; }
    return { cls: 'fm-p-static', dashed: true };
}

/** Escape text for XML/SVG. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Truncate a node line so it fits the box width. Per-role budget: the bold 13.5px title fits ~20
 * chars in the 168px portrait card; the 11.5px detail lines fit ~24 — a flat budget both overflowed
 * titles and needlessly cut detail lines. Both shrank with the card (was 29/34 at 236px wide).
 */
function clip(line: string, isTitle: boolean): string {
    const max = isTitle ? 20 : 24;
    return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

interface Placed {
    readonly node: FlowNode;
    readonly lines: string[];
    x: number;
    y: number;
    readonly w: number;
    readonly h: number;
    /** Captures taken on this screen, first one drawn as the card's thumbnail. Empty when none. */
    readonly shots: readonly FlowShot[];
}

/** Measure and pre-format one row's nodes: display lines, thumbnail reservation, box height. */
function buildRow(row: readonly FlowNode[], shots: ShotsByScreen): Placed[] {
    return row.map(node => {
        const raw = nodeDisplayLines(node, false);
        raw[0] = `${kindIcon(node)} ${raw[0]}`;
        const lines = raw.map((line, i) => clip(line, i === 0));
        const own = shots.get(node.key) ?? [];
        // A card with no capture keeps its old short height rather than reserving an empty frame —
        // a column of tall blanks would cost vertical space to say nothing.
        const thumb = own.length > 0 ? THUMB_BLOCK_H : 0;
        return { node, lines, x: 0, y: 0, w: BOX_W, h: thumb + PAD_Y * 2 + lines.length * LINE_H, shots: own };
    });
}

/** Pixel width of a row of `count` cards, gaps included. */
function rowWidth(count: number): number {
    return count * BOX_W + (count - 1) * COL_GAP;
}

/** Where the fault column starts, and the y it may not grow past before wrapping to a new column. */
interface FaultColumnFit { readonly x: number; readonly maxY: number; }

/** How far down the fault column(s) reached, and how many columns it took. */
interface FaultColumnPlacement { readonly bottom: number; readonly columns: number; }

/**
 * Stack terminal fault cards in a column to the right of the walk, each at or below its parent's
 * bottom edge so the parent→fault arrow still reads downward. Parents are visited top-down and share
 * a single cursor, so two parents on adjacent rows can never have their stacks overlap.
 *
 * A stack that would pass `fit.maxY` starts ANOTHER column instead of growing: twenty faults under
 * one screen would otherwise produce a 2000px column beside a 400px walk, which is unreadable and
 * unbounded — the very failure the fault column exists to fix, rotated ninety degrees.
 */
function placeFaultLeaves(
    leaves: ReadonlyMap<string, readonly FlowNode[]>,
    placed: Map<string, Placed>, shots: ShotsByScreen, fit: FaultColumnFit,
): FaultColumnPlacement {
    // One cursor per column, so a card can go in the leftmost column that still has room. Always
    // appending to the trailing column stranded earlier ones half-empty and spent width the cards
    // did not need.
    const cursors: number[] = [];
    const groups = [...leaves].sort((a, b) => (placed.get(a[0])?.y ?? 0) - (placed.get(b[0])?.y ?? 0));
    for (const [parentKey, nodes] of groups) {
        const parent = placed.get(parentKey);
        // Every one of this parent's cards starts at or below its bottom edge, whichever column it
        // lands in, so the parent→fault arrow always reads downward.
        const floor = parent ? parent.y + parent.h + FAULT_GAP : MARGIN;
        for (const p of buildRow(nodes, shots)) {
            const col = pickFaultColumn(cursors, floor, p.h, fit.maxY);
            const top = Math.max(cursors[col], floor);
            p.x = fit.x + col * (BOX_W + COL_GAP);
            p.y = top;
            placed.set(p.node.key, p);
            cursors[col] = top + p.h + FAULT_GAP;
        }
    }
    return { bottom: Math.max(MARGIN, ...cursors), columns: cursors.length };
}

/**
 * The leftmost fault column this card fits in, opening a new one when none has room. A column's
 * FIRST card always fits: an over-tall card must land somewhere rather than open columns forever.
 */
function pickFaultColumn(cursors: number[], floor: number, height: number, maxY: number): number {
    for (let i = 0; i < cursors.length; i++) {
        const top = Math.max(cursors[i], floor);
        if (cursors[i] === MARGIN || top + height <= maxY) { return i; }
    }
    cursors.push(MARGIN);
    return cursors.length - 1;
}

/** Position every node; returns placements + the overall canvas size. */
function layout(graph: FlowGraph, shots: ShotsByScreen): { placed: Map<string, Placed>; width: number; height: number } {
    const plan = planRows(graph);
    const built = plan.rows.map(row => buildRow(row, shots));
    const maxWidth = Math.max(...built.map(r => rowWidth(r.length)), BOX_W);
    const placed = new Map<string, Placed>();
    let y = MARGIN;
    for (const row of built) {
        let x = MARGIN + (maxWidth - rowWidth(row.length)) / 2;
        const rowHeight = Math.max(...row.map(p => p.h));
        for (const p of row) {
            p.x = x;
            p.y = y;
            placed.set(p.node.key, p);
            x += BOX_W + COL_GAP;
        }
        y += rowHeight + ROW_GAP;
    }
    const columnX = MARGIN + maxWidth + COL_GAP;
    // Let the fault column run as deep as the walk, but never shorter than FAULT_COL_CARDS' worth —
    // a one-row walk with six faults should stack them, not fan into six columns to match its own
    // height.
    const maxY = Math.max(y - ROW_GAP, MARGIN + FAULT_COL_CARDS * FAULT_CARD_MIN_H);
    const faults = placeFaultLeaves(plan.faultLeaves, placed, shots, { x: columnX, maxY });
    // The column only costs width when something is actually in it.
    const contentW = faults.columns > 0
        ? columnX - MARGIN + faults.columns * BOX_W + (faults.columns - 1) * COL_GAP
        : maxWidth;
    // Floor BOTH axes at the margins and reject non-finite values: a zero-node graph computes a
    // NEGATIVE height, and any negative/NaN viewBox dimension is an invalid SVG that browsers
    // silently render as nothing — a blank panel with no console error to trace it by.
    return {
        placed,
        width: safeDimension(contentW + MARGIN * 2, BOX_W),
        height: safeDimension(Math.max(y - ROW_GAP, faults.bottom - FAULT_GAP) + MARGIN, MARGIN * 2),
    };
}

/** Clamp a computed canvas dimension to a valid positive number, falling back when non-finite. */
function safeDimension(value: number, floor: number): number {
    return Number.isFinite(value) ? Math.max(value, floor) : floor;
}

/** The table row key a node cross-links to: crash nodes target the crash issue row. */
function rowKeyOf(node: FlowNode): string {
    return nodeHasError(node) ? 'crash' : node.key;
}

/**
 * Serialize every fact known about a node into a `data-detail` JSON attribute. The webview reads it
 * on double-click to build the exhaustive detail popup — keeping all node data on the element means
 * no separate JSON island (which the strict nonce-only CSP would otherwise complicate). esc() turns
 * the JSON quotes into &quot;, which the browser decodes back before JSON.parse.
 */
function detailAttr(node: FlowNode): string {
    const detail = {
        label: node.label,
        kind: node.kind,
        visits: node.visits,
        dwellMs: node.dwellMs,
        firstTsMs: node.firstTsMs ?? null,
        lastTsMs: node.lastTsMs ?? null,
        file: node.source?.file ?? null,
        fileLine: node.source?.line ?? null,
        logLine: node.logLine ?? null,
        walked: node.walked,
        resolved: node.resolved,
        actions: node.actionCounts,
        issues: node.issues.map(i => ({ sev: i.severity, cat: i.category, detail: i.detail, clock: i.clock, log: i.logLine ?? null })),
    };
    return ` data-detail="${esc(JSON.stringify(detail))}"`;
}

/** Render one node as an interactive group: box + stacked text lines, tagged for cross-highlight. */
function renderNode(p: Placed): string {
    const pal = paletteOf(p.node);
    const dash = pal.dashed ? ' stroke-dasharray="4 3"' : '';
    const cx = p.x + p.w / 2;
    // Text starts below the thumbnail when the screen was captured; `<text y>` is the anchor the
    // per-line dy offsets accumulate from, so shifting it moves the whole stack in one place.
    const textTop = p.y + (p.shots.length > 0 ? THUMB_BLOCK_H : 0);
    const tspans = p.lines.map((line, i) => {
        const isTitle = i === 0;
        const weight = isTitle ? ' font-weight="700"' : '';
        const size = isTitle ? 13.5 : 11.5;
        const dy = isTitle ? PAD_Y + 13 : LINE_H;
        const lineCls = isTitle ? 'fm-t-title' : 'fm-t-sub';
        return `<tspan x="${cx}" dy="${dy}" font-size="${size}" class="${lineCls}"${weight}>${esc(line)}</tspan>`;
    }).join('');
    const cls = nodeHasError(p.node) ? `fm-node fm-crash ${pal.cls}` : `fm-node ${pal.cls}`;
    const logAttr = p.node.logLine ? ` data-logline="${p.node.logLine}"` : '';
    return `<g class="${cls}" data-rowkey="${esc(rowKeyOf(p.node))}"${logAttr}${detailAttr(p.node)} tabindex="0" role="button">`
        // class="fm-box": the palette/hover/pulse rules target THIS rect by class, never by element.
        // A bare `rect` descendant selector also matches the thumbnail frame and the count pill —
        // which are siblings in this same group — and a CSS `fill` overrides their `fill="none"`
        // presentation attribute, painting the node's color straight over the screenshot.
        + `<rect class="fm-box" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" `
        + `stroke-width="1.5"${dash}/>`
        + thumbMarkup(p.x, p.y, p.shots, p.node.key)
        + `<text x="${cx}" y="${textTop}" text-anchor="middle" `
        + `font-family="var(--vscode-font-family)">${tspans}</text>${visitBadge(p)}</g>`;
}

/** A circular repeat-visit badge straddling the node's top-right corner (e.g. ②). Only for revisits — a "1" on nearly every node was noise. */
function visitBadge(p: Placed): string {
    if (p.node.kind === 'launch' || !p.node.walked || p.node.visits < 2) {
        return '';
    }
    const cx = p.x + p.w;
    const cy = p.y;
    return `<circle class="fm-badge" cx="${cx}" cy="${cy}" r="11" stroke-width="2"/>`
        + `<text class="fm-badge-text" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" `
        + `font-size="11" font-weight="700" font-family="var(--vscode-font-family)">${p.node.visits}</text>`;
}

/** The edge label: dwell on the source before taking THIS edge, plus count / "opens". */
function edgeLabel(edge: FlowEdge, from: Placed): string {
    const parts: string[] = [];
    // Per-edge dwell (accumulated at transition time), NOT the node's total across all visits —
    // a thrice-visited screen would otherwise stamp its whole lifetime on every outgoing arrow.
    // Dwell is meaningful leaving a real screen, not the synthetic launch node.
    if (from.node.kind !== 'launch' && (edge.dwellMs ?? 0) >= 1000) {
        parts.push(formatDwellMs(edge.dwellMs ?? 0));
    }
    if (edge.count > 1) { parts.push(`×${edge.count}`); }
    if (edge.inferred) { parts.push('opens'); }
    return parts.join(' · ');
}

/**
 * A return-to-caller edge: the user closed the surface(s) above an ancestor and went back to it.
 * Bowed to the RIGHT of the boxes (so it never overlaps the forward arrow running down the middle)
 * and drawn dashed-blue with its own marker so it reads as "back", not another forward step.
 */
function renderBackEdge(from: Placed, to: Placed, edge: FlowEdge, backIndex: number): string {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x + to.w;
    const y2 = to.y + to.h / 2;
    // Stagger each back edge's bulge so two returns on the right side never draw on top of each other.
    const bx = Math.max(x1, x2) + BACK_BULGE + backIndex * BACK_STAGGER;
    const path = `<path class="fm-e-back" d="M${x1},${y1} C${bx},${y1} ${bx},${y2} ${x2},${y2}" fill="none" `
        + `stroke-width="1.5" stroke-dasharray="2 4" marker-end="url(#fm-back)"/>`;
    if (edge.count <= 1) { return path; }
    return path + `<text class="fm-e-back-label" x="${bx + 4}" y="${(y1 + y2) / 2}" text-anchor="start" dominant-baseline="middle" `
        + `font-size="10" font-family="var(--vscode-font-family)">×${edge.count}</text>`;
}

/** Render one edge: a line from the source's bottom to the target's top, with the dwell/count label. */
function renderEdge(edge: FlowEdge, placed: Map<string, Placed>, backIndex: number): string {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) { return ''; }
    if (edge.back) { return renderBackEdge(from, to, edge, backIndex); }
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const dash = edge.walked ? '' : ' stroke-dasharray="5 4"';
    const line = `<line class="fm-e-fwd" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `
        + `stroke-width="1.5"${dash} marker-end="url(#fm-arrow)"/>`;
    const label = edgeLabel(edge, from);
    if (!label) { return line; }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    // Park the dwell label to the RIGHT of the shaft (anchor start + gap), vertically centered on the
    // midpoint, so the time is never painted on top of the arrow where it was unreadable.
    return line + `<text class="fm-e-label" x="${mx + EDGE_LABEL_GAP}" y="${my}" text-anchor="start" dominant-baseline="middle" `
        + `font-size="11" font-family="var(--vscode-font-family)" paint-order="stroke" `
        + `stroke-width="3">${esc(label)}</text>`;
}

/**
 * Render the whole graph as an `<svg>` element string. `shots` (optional) are the session's captures:
 * each screen's first one is drawn as its card's thumbnail, with a count pill when it has several.
 */
export function renderSvg(graph: FlowGraph, shots: readonly FlowShot[] = []): string {
    const { placed, width, height } = layout(graph, groupShotsByScreen(shots));
    // Reserve room on the right for the WIDEST back-edge bulge so no staggered curve gets clipped.
    const backCount = graph.edges.filter(e => e.back).length;
    const canvasW = backCount > 0 ? width + BACK_BULGE + (backCount - 1) * BACK_STAGGER + 10 : width;
    // Marker heads take their fill from CSS classes (theme tokens), like every other diagram color.
    const defs = '<defs>'
        + '<marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        + 'markerHeight="7" orient="auto-start-reverse"><path class="fm-arrow-head" d="M0,0 L10,5 L0,10 z"/></marker>'
        + '<marker id="fm-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        + 'markerHeight="7" orient="auto-start-reverse"><path class="fm-back-head" d="M0,0 L10,5 L0,10 z"/></marker>'
        + '</defs>';
    let backIdx = 0;
    const edges = graph.edges.map(e => renderEdge(e, placed, e.back ? backIdx++ : 0)).join('');
    const nodes = [...placed.values()].map(renderNode).join('');
    return `<svg viewBox="0 0 ${canvasW} ${height}" width="${canvasW}" height="${height}" `
        + `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Session flow diagram">`
        + `${defs}${edges}${nodes}</svg>`;
}
