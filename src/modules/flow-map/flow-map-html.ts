/**
 * Builds the inner HTML body for the native flow-map webview (plan 056, S1 as a panel). Renders the
 * SVG diagram beside the narrative, collapsible sections, a section TOC, and the dwell/issue tables.
 * Every row links back to BOTH the source `file:line` (R5) and the originating LOG line — clicking
 * reveals it in the log viewer or copies the raw line. The panel wraps this with CSP, styles, the
 * stat pills, and the save button.
 */

import type { FlowGraph, FlowNode, IssueEvent, ParsedLog, SourceAnchor } from './flow-map-model';
import type { FlowShot } from './flow-map-screenshots';
import { anchorText, formatActions, formatDwellMs, nodeHasError, stripAnsi } from './flow-map-format';
import { renderSvg } from './flow-map-svg';
import { t } from '../../l10n';
import { buildNarrative } from './flow-map-report';
import { activityChartHtml } from './flow-map-activity-chart';

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

/** Localized labels for `FlowNode.kind`, built lazily so `t()` sees a workspace locale, not import time. */
function kindLabel(): Record<FlowNode['kind'], string> {
    return {
        launch: '—', screen: t('flowMap.kind.screen'), tab: t('flowMap.kind.tab'),
        dialog: t('flowMap.kind.dialog'), inline: t('flowMap.kind.inline'), external: t('flowMap.kind.external'),
        unknown: '—',
    };
}

/** A clickable source `file:line` cell (opens in editor), or an em-dash. */
function sourceCell(source?: SourceAnchor): string {
    const text = anchorText(source);
    if (!text) {
        return '<td class="src-empty">—</td>';
    }
    return `<td><span class="src" role="link" tabindex="0" data-file="${esc(source?.file ?? '')}" `
        + `data-line="${source?.line ?? 1}" title="${esc(t('flowMap.title.openInEditor'))}">${esc(text)}</span></td>`;
}

/** A log-line cell: reveal the raw log line in the viewer, or copy it. Em-dash when unknown. */
function logCell(logLine?: number): string {
    if (!logLine) {
        return '<td class="src-empty">—</td>';
    }
    return `<td class="logcell"><span class="loglink" role="link" tabindex="0" data-line="${logLine}" `
        + `title="${esc(t('flowMap.title.revealInLog'))}">L${logLine}</span>`
        + `<span class="logcopy" role="button" tabindex="0" data-line="${logLine}" `
        + `title="${esc(t('flowMap.title.copyLogLine'))}">⧉</span></td>`;
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

/** Labeled session-info grid: the clickable log path, build/device facts, and the session stats. */
function sessionInfoHtml(parsed: ParsedLog, graph: FlowGraph, logPath?: string): string {
    const h = parsed.header;
    const row = (k: string, v?: string) =>
        v ? `<div class="si-k">${k}</div><div class="si-v">${esc(v)}</div>` : '';
    const screens = graph.nodes.filter(n => n.walked && n.kind !== 'launch').length;
    // Launch visits beyond the first are hot restarts recovered from `App Startup` lifecycle lines.
    const restarts = Math.max(0, (graph.nodes.find(n => n.kind === 'launch')?.visits ?? 1) - 1);
    const pathRow = logPath
        ? `<div class="si-k">${t('flowMap.si.log')}</div><div class="si-v"><span class="logpath" role="link" `
            + `tabindex="0" title="${esc(t('flowMap.title.openInViewer'))}">${esc(logPath)}</span></div>`
        : '';
    return '<div class="session-info">'
        + pathRow
        + row(t('flowMap.si.project'), h.project) + row(t('flowMap.si.branch'), h.branch)
        + row(t('flowMap.si.commit'), h.commit)
        + row(t('flowMap.si.device'), h.device) + row(t('flowMap.si.version'), h.version)
        + row(t('flowMap.si.captured'), `${h.captureStartClock ?? '?'} → ${parsed.lastClock ?? '?'}`)
        + row(t('flowMap.si.screens'), String(screens)) + row(t('flowMap.si.duration'), durationText(parsed))
        + row(t('flowMap.si.slowQueries'), String(parsed.slowQueryCount))
        + row(t('flowMap.si.repeatBatches'), String(parsed.repeatBatchCount))
        + row(t('flowMap.si.crashes'), String(parsed.crashes.length))
        + (restarts > 0 ? row(t('flowMap.si.restarts'), String(restarts)) : '')
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
    const labels = kindLabel();
    const rows = walked
        .sort((a, b) => (a.firstTsMs ?? 0) - (b.firstTsMs ?? 0))
        .map(n => {
            const actions = stripAnsi(formatActions(n));
            const cleanLabel = esc(stripAnsi(n.label));
            const label = actions ? `${cleanLabel} · ${esc(actions)}` : cleanLabel;
            const entered = n.firstTsMs !== undefined ? clockOf(n.firstTsMs) : '';
            return `<tr data-key="${esc(n.key)}"><td>${label}</td><td class="ctr">${labels[n.kind]}</td>`
                + `<td class="num">${entered}</td>${dwellCell(n, maxDwell)}<td class="num">${n.visits}</td>`
                + `${sourceCell(n.source)}${logCell(n.logLine)}</tr>`;
        }).join('');
    return `<table><thead><tr><th>${t('flowMap.th.screenPhase')}</th><th class="ctr">${t('flowMap.th.type')}</th>`
        + `<th class="num">${t('flowMap.th.entered')}</th><th>${t('flowMap.th.duration')}</th>`
        + `<th class="num">${t('flowMap.th.visits')}</th><th>${t('flowMap.th.source')}</th>`
        + `<th>${t('flowMap.th.log')}</th></tr></thead><tbody>${rows}</tbody></table>`;
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
    // `sortable` opts the table into client-side column sorting (script wires the headers). The Time
    // header carries `num` so the sorter compares parsed HH:MM:SS, not raw text.
    return `<table class="sortable"><thead><tr><th class="num">${t('flowMap.th.time')}</th>`
        + `<th>${t('flowMap.th.sev')}</th><th>${t('flowMap.th.what')}</th><th>${t('flowMap.th.detail')}</th>`
        + `<th>${t('flowMap.th.source')}</th><th>${t('flowMap.th.log')}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Executive-summary body: the generated narrative plus a copy button that reveals on hover. The
 * button has no inline text payload — the script reads the rendered paragraph's textContent and
 * asks the host to copy it, so the clipboard gets clean prose without the HTML escaping.
 */
function narrativeSectionHtml(parsed: ParsedLog, graph: FlowGraph): string {
    const copySummary = esc(t('flowMap.title.copySummary'));
    return '<div class="narrative-block">'
        + `<button type="button" class="copy-narrative" title="${copySummary}" aria-label="${copySummary}">⧉</button>`
        + '<p id="narrative-text">' + esc(buildNarrative(parsed, graph)) + '</p></div>';
}

/** A collapsible section. */
function section(id: string, title: string, body: string): string {
    return `<details class="sec" id="${id}" open><summary>${title}</summary><div class="sec-body">${body}</div></details>`;
}

/** Truncate alt/caption text to a readable length without cutting mid-word where avoidable. */
function truncate(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/** One screenshot figure: clickable thumbnail (reuses the log-reveal path) + a clock/trigger/screen caption. */
function shotFigureHtml(shot: FlowShot): string {
    const dataLine = shot.logLine > 0 ? ` data-line="${shot.logLine}"` : '';
    const alt = esc(truncate(stripAnsi(shot.text), 80));
    const screen = shot.screenLabel ? esc(stripAnsi(shot.screenLabel)) : '—';
    const caption = `${esc(shot.clock)} · ${esc(shot.trigger)} · ${screen}`;
    return `<figure class="shot-fig"><img class="shot-img loglink" role="link" tabindex="0"${dataLine} `
        + `src="${shot.dataUri}" alt="${alt}" title="${alt}"><figcaption class="shot-cap">${caption}</figcaption></figure>`;
}

/** Screenshot gallery body: a grid of figures plus an omitted-count note when the report capped the set. */
function screenshotsSectionHtml(shots: readonly FlowShot[], omitted: number): string {
    const grid = `<div class="shot-grid">${shots.map(shotFigureHtml).join('')}</div>`;
    const more = omitted > 0 ? `<p class="shot-more">${esc(t('flowMap.shots.more', String(omitted)))}</p>` : '';
    return grid + more;
}

/**
 * Localized section titles keyed by section id, emoji baked into the template (not translated).
 * Single source of truth shared by `tocHtml()` and the `section()` calls in `buildFlowMapBody()`.
 */
function sectionTitles(): Record<string, string> {
    return {
        flow: `🗺️ ${t('flowMap.section.flow')}`,
        narrative: `📝 ${t('flowMap.section.narrative')}`,
        session: `🧾 ${t('flowMap.section.session')}`,
        screenshots: `📸 ${t('flowMap.section.screenshots')}`,
        activity: `📈 ${t('flowMap.section.activity')}`,
        dwell: `⏱️ ${t('flowMap.section.dwell')}`,
        issues: `📊 ${t('flowMap.section.issues')}`,
    };
}

/** Section table of contents (jumps to and expands a section). Omits Screenshots when there are none. */
function tocHtml(titles: Record<string, string>, hasShots: boolean): string {
    const items: [string, string][] = [
        ['sec-flow', titles.flow], ['sec-narrative', titles.narrative], ['sec-session', titles.session],
        ...(hasShots ? [['sec-shots', titles.screenshots] as [string, string]] : []),
        ['sec-activity', titles.activity], ['sec-dwell', titles.dwell], ['sec-perf', titles.issues],
    ];
    return '<nav class="toc">'
        + items.map(([id, label]) => `<a href="#${id}" data-target="${id}">${label}</a>`).join('')
        + '</nav>';
}

/** An info-circle button whose tooltip shows the diagram legend on hover/focus. */
function flowLegend(): string {
    return `<span class="fm-legend-tip" tabindex="0" role="button" aria-label="${esc(t('flowMap.legendAria'))}"`
        + ` data-tip="${esc(t('flowMap.legendTip'))}"`
        + '>ℹ</span>';
}

/**
 * The diagram block: an overlay zoom/pan/fit toolbar (plus center-on-fault when a node faulted, and
 * an optional pop-out) over the SVG, which sits in a scroll container so zoom grows scrollbars and
 * the chart centers via margin:auto when it is smaller than the viewport. Glyphs are symbols (exempt
 * from l10n); titles are localized. `withPopout` is false inside the already-popped-out panel.
 */
export function flowDiagramHtml(graph: FlowGraph, withPopout: boolean): string {
    const hasCrash = graph.nodes.some(nodeHasError);
    const btn = (zoom: string, glyph: string, label: string, extra = '') =>
        `<button class="fm-zoom-btn${extra}" data-zoom="${zoom}" title="${label}" aria-label="${label}">${glyph}</button>`;
    const zoomToolbar = '<div class="fm-zoom-toolbar">'
        + btn('in', '+', t('flowMap.zoomInBtn'))
        + btn('out', '−', t('flowMap.zoomOutBtn'))
        + btn('reset', '⧉', t('flowMap.resetViewBtn'))
        + btn('replay', '▶', t('flowMap.replayBtn'))
        + (hasCrash ? btn('crash', '💥', t('flowMap.jumpToCrashBtn'), ' fm-zoom-crash') : '')
        + (withPopout ? btn('popout', '⤢', t('flowMap.popOutBtn')) : '')
        + '</div>';
    return '<div class="diagram">' + zoomToolbar + '<div class="diagram-scroll">' + renderSvg(graph) + '</div></div>';
}

/** Diagram-only body for the pop-out panel: the legend plus the full-area diagram, no tables/TOC. */
export function buildFlowDiagramBody(graph: FlowGraph): string {
    return '<div class="diagram-only">' + flowLegend() + flowDiagramHtml(graph, false) + '</div>';
}

/** Screenshot gallery inputs, bundled to keep `buildFlowMapBody` within the 4-parameter limit. */
export interface FlowShotsInput {
    readonly screenshots: readonly FlowShot[];
    readonly screenshotsOmitted: number;
}

/**
 * Build the inner webview body (the panel adds doctype/CSP/styles/topbar). `shots` is omitted (or its
 * `screenshots` array is empty) when the log has no sidecar captures — the Screenshots section and its
 * TOC entry are then left out entirely rather than rendered blank (Phase E, plan 117).
 */
export function buildFlowMapBody(
    parsed: ParsedLog, graph: FlowGraph, logPath?: string, shots?: FlowShotsInput,
): string {
    // Two-column report: the (potentially very tall) diagram on the left; the narrative and both
    // tables stacked in a right column so they stay visible alongside the diagram, not buried under
    // it. The row wraps to a single column when the panel is narrow.
    const titles = sectionTitles();
    const screenshots = shots?.screenshots ?? [];
    const hasShots = screenshots.length > 0;
    const diagramCol = '<div class="diagram-col">'
        + section('sec-flow', titles.flow, flowLegend() + flowDiagramHtml(graph, true))
        + '</div>';
    const shotsSection = hasShots
        ? section('sec-shots', titles.screenshots, screenshotsSectionHtml(screenshots, shots?.screenshotsOmitted ?? 0))
        : '';
    const detailCol = '<div class="detail-col">'
        + section('sec-narrative', titles.narrative, narrativeSectionHtml(parsed, graph))
        + section('sec-session', titles.session, sessionInfoHtml(parsed, graph, logPath))
        + shotsSection
        + section('sec-activity', titles.activity, activityChartHtml(parsed, clockOf))
        + section('sec-dwell', titles.dwell, dwellTableHtml(graph))
        + section('sec-perf', titles.issues, issueTableHtml(parsed))
        + '</div>';
    // A draggable divider between the two columns lets the reader trade diagram width for detail
    // width; the script persists the chosen split. It hides when the row wraps to a single column.
    const resizer = '<div class="col-resize" role="separator" aria-orientation="vertical" '
        + `tabindex="-1" title="${esc(t('flowMap.title.dragToResize'))}"></div>`;
    // Title + clickable log path are rendered by the panel above the bar; the body starts at the TOC.
    return [
        tocHtml(titles, hasShots),
        '<div class="report-row">' + diagramCol + resizer + detailCol + '</div>',
    ].join('\n');
}
