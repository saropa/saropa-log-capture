/**
 * Builds the inner HTML body for the native flow-map webview (plan 056, S1 as a panel). Renders the
 * SVG diagram beside the narrative, collapsible sections, a section TOC, and the dwell/issue tables.
 * Every row links back to BOTH the source `file:line` (R5) and the originating LOG line — clicking
 * reveals it in the log viewer or copies the raw line. The panel wraps this with CSP, styles, the
 * stat pills, and the save button.
 */

import type { FlowGraph, FlowNode, IssueEvent, ParsedLog, SourceAnchor } from './flow-map-model';
import { anchorText, formatActions, formatDwellMs, stripAnsi } from './flow-map-format';
import { renderSvg } from './flow-map-svg';
import { buildNarrative } from './flow-map-report';

/** Escape text for HTML. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert ms-of-day to an HH:MM:SS clock. */
function clockOf(tsMs: number): string {
    const s = Math.floor(tsMs / 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const SEV_ICON: Record<IssueEvent['severity'], string> = {
    info: 'ℹ️', warn: '⚠️', perf: '🐢', error: '💥',
};

const KIND_LABEL: Record<FlowNode['kind'], string> = {
    launch: '—', screen: 'screen', tab: 'tab', dialog: 'dialog', inline: 'inline', unknown: '—',
};

/** A clickable source `file:line` cell (opens in editor), or an em-dash. */
function sourceCell(source?: SourceAnchor): string {
    const text = anchorText(source);
    if (!text) {
        return '<td class="src-empty">—</td>';
    }
    return `<td><span class="src" role="link" tabindex="0" data-file="${esc(source?.file ?? '')}" `
        + `data-line="${source?.line ?? 1}" title="Open in editor">${esc(text)}</span></td>`;
}

/** A log-line cell: reveal the raw log line in the viewer, or copy it. Em-dash when unknown. */
function logCell(logLine?: number): string {
    if (!logLine) {
        return '<td class="src-empty">—</td>';
    }
    return `<td class="logcell"><span class="loglink" role="link" tabindex="0" data-line="${logLine}" `
        + `title="Reveal in log">L${logLine}</span>`
        + `<span class="logcopy" role="button" tabindex="0" data-line="${logLine}" title="Copy log line">⧉</span></td>`;
}

/** Parse an HH:MM:SS clock to seconds, or undefined. */
function clockToSec(clock?: string): number | undefined {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(clock ?? '');
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : undefined;
}

/** Human session span from the first to last timestamped line (e.g. "1h 10m", "47m"). */
function durationText(parsed: ParsedLog): string {
    const a = clockToSec(parsed.header.captureStartClock);
    const b = clockToSec(parsed.lastClock);
    if (a === undefined || b === undefined || b < a) { return '—'; }
    const mins = Math.round((b - a) / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

/** A stat pill spec. `line` (when set) makes the pill reveal that log line on click. */
interface Pill { readonly icon: string; readonly value: string; readonly label: string; readonly tone: string; readonly line?: number; }

/** Render one colored stat pill. */
function pill(p: Pill): string {
    const link = p.line ? ` pill-link" role="link" tabindex="0" data-line="${p.line}" title="Reveal in log` : '';
    return `<span class="pill pill-${p.tone}${link}">${p.icon} <b>${esc(p.value)}</b> ${esc(p.label)}</span>`;
}

/** Compact colored stat pills for the top bar (exported — placed next to the save button). */
export function statPillsHtml(parsed: ParsedLog, graph: FlowGraph): string {
    const screens = graph.nodes.filter(n => n.walked && n.kind !== 'launch').length;
    // Each number traces to a log line: duration → the session-start banner, slow → the worst query,
    // crash → the exception. Screens/repeat have no single representative line, so they stay static.
    const slowLine = parsed.issues.find(i => i.category === 'Slow query')?.logLine;
    return [
        { icon: '🧭', value: String(screens), label: 'screens', tone: 'green' },
        { icon: '⏱️', value: durationText(parsed), label: 'duration', tone: 'blue', line: 1 },
        { icon: '🐢', value: String(parsed.slowQueryCount), label: 'slow', tone: 'amber', line: slowLine },
        { icon: '🔁', value: String(parsed.repeatBatchCount), label: 'repeat', tone: 'purple' },
        { icon: parsed.crash ? '💥' : '✓', value: parsed.crash ? '1' : '0', label: 'crash', tone: parsed.crash ? 'red' : 'green', line: parsed.crash?.logLine },
    ].map(pill).join('');
}

/** Labeled session-info grid (project, branch, device, …) for the collapsible section. */
function sessionInfoHtml(parsed: ParsedLog): string {
    const h = parsed.header;
    const row = (k: string, v?: string) =>
        v ? `<div class="si-k">${k}</div><div class="si-v">${esc(v)}</div>` : '';
    return '<div class="session-info">'
        + row('Project', h.project) + row('Branch', h.branch) + row('Commit', h.commit)
        + row('Device', h.device) + row('Version', h.version)
        + row('Captured', `${h.captureStartClock ?? '?'} → ${parsed.lastClock ?? '?'}`)
        + '</div>';
}

/** A proportional dwell bar + text cell. */
function dwellCell(node: FlowNode, maxDwell: number): string {
    const pct = maxDwell > 0 ? Math.max(3, Math.round((node.dwellMs / maxDwell) * 100)) : 0;
    return `<td class="dwell"><span class="dwell-bar" style="width:${pct}%"></span>`
        + `<span class="dwell-text">${esc(formatDwellMs(node.dwellMs))}</span></td>`;
}

/** Dwell table over walked nodes, in entry order. Rows carry data-key for diagram cross-highlight. */
function dwellTableHtml(graph: FlowGraph): string {
    const walked = graph.nodes.filter(n => n.walked && n.kind !== 'launch');
    const maxDwell = Math.max(1, ...walked.map(n => n.dwellMs));
    const rows = walked
        .sort((a, b) => (a.firstTsMs ?? 0) - (b.firstTsMs ?? 0))
        .map(n => {
            const actions = stripAnsi(formatActions(n));
            const cleanLabel = esc(stripAnsi(n.label));
            const label = actions ? `${cleanLabel} · ${esc(actions)}` : cleanLabel;
            const entered = n.firstTsMs !== undefined ? clockOf(n.firstTsMs) : '';
            return `<tr data-key="${esc(n.key)}"><td>${label}</td><td class="ctr">${KIND_LABEL[n.kind]}</td>`
                + `<td class="num">${entered}</td>${dwellCell(n, maxDwell)}<td class="num">${n.visits}</td>`
                + `${sourceCell(n.source)}${logCell(n.logLine)}</tr>`;
        }).join('');
    return '<table><thead><tr><th>Screen / phase</th><th class="ctr">Type</th><th class="num">Entered</th>'
        + '<th>Duration</th><th class="num">Visits</th><th>Source</th><th>Log</th>'
        + `</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Issue table over all parsed issues, in time order. Crash row carries data-key for cross-highlight. */
function issueTableHtml(parsed: ParsedLog): string {
    const rows = parsed.issues.map(i => {
        const key = i.category === 'Crash' ? ' data-key="crash"' : '';
        return `<tr class="sev-${i.severity}"${key}><td class="num">${esc(i.clock || '—')}</td>`
            + `<td class="nowrap">${SEV_ICON[i.severity]} ${esc(i.severity)}</td>`
            + `<td class="nowrap">${esc(stripAnsi(i.category))}</td><td>${esc(stripAnsi(i.detail))}</td>`
            + `${sourceCell(i.source)}${logCell(i.logLine)}</tr>`;
    }).join('');
    return '<table><thead><tr><th class="num">Time</th><th>Sev</th><th>What</th><th>Detail</th>'
        + `<th>Source</th><th>Log</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** A collapsible section. */
function section(id: string, title: string, body: string): string {
    return `<details class="sec" id="${id}" open><summary>${title}</summary><div class="sec-body">${body}</div></details>`;
}

/** Section table of contents (jumps to and expands a section). */
function tocHtml(): string {
    const items: [string, string][] = [
        ['sec-flow', '🗺️ Flow'], ['sec-narrative', '📝 Narrative'], ['sec-session', '🧾 Session info'],
        ['sec-dwell', '⏱️ Screen dwell'], ['sec-perf', '📊 Performance'],
    ];
    return '<nav class="toc">'
        + items.map(([id, label]) => `<a href="#${id}" data-target="${id}">${label}</a>`).join('')
        + '</nav>';
}

/** Build the inner webview body (the panel adds doctype/CSP/styles/topbar). */
export function buildFlowMapBody(parsed: ParsedLog, graph: FlowGraph): string {
    // Two-column report: the (potentially very tall) diagram on the left; the narrative and both
    // tables stacked in a right column so they stay visible alongside the diagram, not buried under
    // it. The row wraps to a single column when the panel is narrow.
    const legend = '<p class="legend">Solid = walked · dashed = recovered indirectly · 💥 = fault.'
        + ' Click a node to find its row and jump the log; click a source to open it.</p>';
    const diagramCol = '<div class="diagram-col">'
        + section('sec-flow', '🗺️ Flow', legend + '<div class="diagram">' + renderSvg(graph) + '</div>')
        + '</div>';
    const detailCol = '<div class="detail-col">'
        + section('sec-narrative', '📝 Narrative', '<p>' + esc(buildNarrative(parsed, graph)) + '</p>')
        + section('sec-session', '🧾 Session info', sessionInfoHtml(parsed))
        + section('sec-dwell', '⏱️ Screen dwell', dwellTableHtml(graph))
        + section('sec-perf', '📊 Performance · warnings · errors', issueTableHtml(parsed))
        + '</div>';
    // Title + clickable log path are rendered by the panel above the bar; the body starts at the TOC.
    return [
        tocHtml(),
        '<div class="report-row">' + diagramCol + detailCol + '</div>',
    ].join('\n');
}
