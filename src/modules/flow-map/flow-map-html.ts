/**
 * Builds the inner HTML body for the native flow-map webview (plan 056, S1 as a panel). Renders the
 * SVG diagram beside the narrative, collapsible sections, a section TOC, and the dwell/issue tables.
 * Every row links back to BOTH the source `file:line` (R5) and the originating LOG line — clicking
 * reveals it in the log viewer or copies the raw line. The panel wraps this with CSP, styles, the
 * stat pills, and the save button.
 */

import type { FlowGraph, FlowNode, IssueEvent, ParsedLog, SourceAnchor } from './flow-map-model';
import type { FlowShot } from './flow-map-screenshots';
import { screenshotsSectionHtml } from './flow-map-html-shots';
import { groupShotsByScreen, shotSetsIsland } from './flow-map-svg-shots';
import { anchorText, formatActions, formatDwellMs, nodeHasError, stripAnsi } from './flow-map-format';
import { renderSvg } from './flow-map-svg';
import { t } from '../../l10n';
import { buildNarrative } from './flow-map-report';
import { activityChartHtml } from './flow-map-activity-chart';
import type { BreadcrumbSuggestion } from './flow-map-empty-diagnostic';

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

/** One suggested custom breadcrumb rule: the log's own sample line, its count, and an "Add rule" button. */
function suggestRowHtml(s: BreadcrumbSuggestion): string {
    return '<div class="fm-suggest-row">'
        + `<span class="fm-suggest-sample" title="${esc(s.sample)}">${esc(s.sample)}</span>`
        + `<span class="fm-suggest-count">${esc(String(s.count))}×</span>`
        + `<button type="button" class="fm-suggest-btn" data-pattern="${esc(s.pattern)}" `
        + `data-label="${esc(s.label)}">${esc(t('flowMap.suggestAdd'))}</button></div>`;
}

/**
 * The empty-state onboarding block (breadcrumb diagnostic): repeated `Prefix: value` shapes found in
 * the log's own lines, offered as one-click custom-rule suggestions. Empty when the heuristic found
 * nothing worth suggesting — never renders a block with no rows.
 */
function suggestBlockHtml(suggestions: readonly BreadcrumbSuggestion[]): string {
    if (suggestions.length === 0) {
        return '';
    }
    return '<div class="fm-suggest">'
        + `<p class="fm-suggest-heading">${esc(t('flowMap.suggestHeading'))}</p>`
        + suggestions.map(suggestRowHtml).join('')
        + '</div>';
}

/** Everything the diagram block renders beyond the graph itself. Optional individually. */
export interface FlowDiagramOptions {
    /** Show the pop-out button. False inside the already-popped-out panel. */
    readonly withPopout?: boolean;
    /** Second line of the empty state, naming WHICH empty this is (see `emptyDetailFor`). */
    readonly emptyDetail?: string;
    /** Empty-state custom-rule suggestions mined from the log's own lines. */
    readonly suggestions?: readonly BreadcrumbSuggestion[];
    /** Session captures — one per screen becomes its node's thumbnail (see `pickThumbShot`). */
    readonly screenshots?: readonly FlowShot[];
}

/**
 * The diagram block: an overlay zoom/pan/fit toolbar (plus center-on-fault when a node faulted, and
 * an optional pop-out) over the SVG, which sits in a scroll container so zoom grows scrollbars and
 * the chart centers via margin:auto when it is smaller than the viewport. Glyphs are symbols (exempt
 * from l10n); titles are localized. Options are an object, not positional parameters, because the
 * set outgrew the project's 4-parameter limit once screenshots joined it.
 */
export function flowDiagramHtml(graph: FlowGraph, opts: FlowDiagramOptions = {}): string {
    const { withPopout = false, emptyDetail = '', suggestions = [], screenshots = [] } = opts;
    // No nodes = nothing to draw or zoom. Say so instead of shipping an empty diagram — a log with
    // no navigation breadcrumbs (logcat-only captures, tooling runs) otherwise reads as broken.
    if (graph.nodes.length === 0) {
        const detail = emptyDetail ? `<p class="fm-empty fm-empty-detail">${esc(emptyDetail)}</p>` : '';
        return `<p class="fm-empty">${esc(t('flowMap.emptyDiagram'))}</p>${detail}${suggestBlockHtml(suggestions)}`;
    }
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
    return '<div class="diagram">' + zoomToolbar
        + '<div class="diagram-scroll">' + renderSvg(graph, screenshots) + '</div></div>';
}

/**
 * The Flow section's contents: the legend tooltip above the diagram. The legend is suppressed for an
 * empty graph — a key explaining walked/dashed/fault glyphs reads as broken beside a "no breadcrumbs"
 * note, since there are no glyphs to decode.
 */
function legendAndDiagram(graph: FlowGraph, opts: FlowDiagramOptions = {}): string {
    const legend = graph.nodes.length > 0 ? flowLegend() : '';
    return legend + flowDiagramHtml(graph, opts);
}

/**
 * Second line of the empty state, naming WHICH empty this is. A parser regression and a genuinely
 * breadcrumb-less log both yield zero nodes, and "instrument your app" is actively misleading advice
 * for the former — `lastClock` is set only when timestamped lines were scanned, so it separates
 * "scanned the log, matched nothing" from "recognized nothing at all".
 */
function emptyDetailFor(parsed: ParsedLog): string {
    return parsed.lastClock
        ? t('flowMap.emptyScanned', parsed.lastClock)
        : t('flowMap.emptyNoClock');
}

/**
 * Diagram-only body for the pop-out panel: the legend plus the full-area diagram, no tables/TOC.
 * Screenshots come through so the pop-out's cards carry the same thumbnails as the report's — its
 * host must therefore allow its own `webview.cspSource` as `img-src` and open `localResourceRoots`
 * to the capture directory, exactly as the report panel does. `cspSource` is per-webview: the
 * pop-out cannot borrow the report's.
 */
export function buildFlowDiagramBody(graph: FlowGraph, screenshots: readonly FlowShot[] = []): string {
    // The pop-out renders no gallery but its cards still open the lightbox, so it needs the same
    // capture-set island the report emits — compare would otherwise be dead here alone.
    return '<div class="diagram-only">' + legendAndDiagram(graph, { screenshots }) + '</div>'
        + shotSetsIsland(groupShotsByScreen(screenshots));
}

/**
 * Screenshot gallery + empty-state diagnostic inputs, bundled to keep `buildFlowMapBody` within the
 * 4-parameter limit. `suggestions` rides along here (rather than as its own parameter) for the same
 * reason — see `suggestBreadcrumbPatterns` in `flow-map-empty-diagnostic.ts`.
 */
export interface FlowShotsInput {
    readonly screenshots: readonly FlowShot[];
    readonly screenshotsOmitted: number;
    /** Captures dropped as near-duplicates at capture time; noted in the gallery when non-zero. */
    readonly screenshotsSuppressed?: number;
    readonly suggestions?: readonly BreadcrumbSuggestion[];
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
        + section('sec-flow', titles.flow, legendAndDiagram(graph, {
            withPopout: true, emptyDetail: emptyDetailFor(parsed),
            suggestions: shots?.suggestions ?? [], screenshots,
        }))
        + '</div>';
    const shotsSection = hasShots
        ? section('sec-shots', titles.screenshots, screenshotsSectionHtml(screenshots, {
            omitted: shots?.screenshotsOmitted ?? 0,
            suppressed: shots?.screenshotsSuppressed ?? 0,
        }))
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
        // Once per document, not once per capture element — see `shotSetsIsland`.
        shotSetsIsland(groupShotsByScreen(screenshots)),
    ].join('\n');
}
