/**
 * Session comparison webview — static HTML/CSS assembly
 *
 * Builds the full document string for the comparison panel: stats header, optional Drift SQL toolbar,
 * fingerprint diff table (when `db.hasDriftSql`), and synchronized dual-pane line lists. Extracted
 * from `session-comparison.ts` to satisfy ESLint `max-lines` / `max-params` without changing output.
 *
 * **Escaping:** All user- or log-derived text inserted into the DOM should go through `escapeHtml`
 * (filenames, line bodies, fingerprint cells, summary strings). Fingerprint attributes for jump buttons
 * use `encodeURIComponent` in addition to escaped visible text where needed.
 *
 * **Contract:** `SessionComparisonHtmlArgs` is the single input object so call sites stay stable when
 * new options are added. Script bodies come from `getSessionComparisonWebviewScript` so CSP nonces in
 * the outer template stay the single source of truth for executable content.
 */

import type { DiffLine } from '../../modules/misc/diff-engine';
import type { DbDetectorResult } from '../../modules/db/db-detector-types';
import {
    SESSION_DB_FP_COMPARE_MAX_ROWS,
    type SessionDbFingerprintCompareResult,
    type SessionDbFingerprintDiffRow,
} from '../../modules/db/db-session-fingerprint-diff';
import { escapeHtml } from '../../modules/capture/ansi';
import { getComparisonStyles } from './session-comparison-styles';
import { getSessionComparisonWebviewScript } from './session-comparison-webview-script';

const DB_FP_KIND_LABELS: Record<SessionDbFingerprintDiffRow['kind'], string> = {
    new: 'New',
    removed: 'Gone',
    more: 'More',
    fewer: 'Less',
    same: 'Same',
};

/** Pane stats needed to render the comparison body (avoids pulling in `vscode.Uri` here). */
export interface SessionComparisonPaneViewModel {
    readonly uniqueCount: number;
    readonly lines: readonly DiffLine[];
}

/** Single object keeps `buildSessionComparisonHtml` within ESLint `max-params`. */
export interface SessionComparisonHtmlArgs {
    readonly nonce: string;
    readonly nameA: string;
    readonly nameB: string;
    readonly commonCount: number;
    readonly syncScrolling: boolean;
    readonly driftInstalled: boolean;
    /** When false, Drift SQL toolbar buttons are omitted. */
    readonly showDbToolbar: boolean;
    readonly db: SessionDbFingerprintCompareResult;
    /** Batch compare detector markers (e.g. SQL volume up); empty when DB insights are off or no hits. */
    readonly dbCompareDetectorResults: readonly DbDetectorResult[];
    readonly sessionA: SessionComparisonPaneViewModel;
    readonly sessionB: SessionComparisonPaneViewModel;
}

export function generateWebviewNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function buildSessionComparisonHtml(args: SessionComparisonHtmlArgs): string {
    const {
        nonce,
        nameA,
        nameB,
        commonCount,
        syncScrolling,
        driftInstalled,
        showDbToolbar,
        db,
        dbCompareDetectorResults,
        sessionA,
        sessionB,
    } = args;
    const toolbar = renderDbToolbar(showDbToolbar, driftInstalled);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        ${getComparisonStyles()}
    </style>
</head>
<body>
    <div role="main" aria-label="Session Comparison">
    <div class="header">
        <div class="stats">
            <span class="stat"><span class="unique-a-dot"></span> ${sessionA.uniqueCount} unique to A</span>
            <span class="stat"><span class="unique-b-dot"></span> ${sessionB.uniqueCount} unique to B</span>
            <span class="stat">${commonCount} common</span>
        </div>
        <button id="sync-btn" class="sync-btn ${syncScrolling ? 'active' : ''}" aria-label="Toggle sync scrolling">
            Sync Scroll: ${syncScrolling ? 'ON' : 'OFF'}
        </button>
    </div>
    ${toolbar}
    ${renderDatabaseFingerprintSection(db, nameA, nameB, dbCompareDetectorResults)}
    <div class="comparison">
        <div class="pane pane-a">
            <div class="pane-header">${escapeHtml(nameA)}</div>
            <div class="pane-content" id="pane-a">
                ${renderLines(sessionA.lines, 'a')}
            </div>
        </div>
        <div class="pane pane-b">
            <div class="pane-header">${escapeHtml(nameB)}</div>
            <div class="pane-content" id="pane-b">
                ${renderLines(sessionB.lines, 'b')}
            </div>
        </div>
    </div>
    </div>
    <script nonce="${nonce}">
        ${getSessionComparisonWebviewScript(syncScrolling, driftInstalled)}
    </script>
</body>
</html>`;
}

function renderDbToolbar(showDbToolbar: boolean, driftInstalled: boolean): string {
    if (!showDbToolbar) {
        return '';
    }
    const driftBtn = driftInstalled
        ? '<button type="button" id="btn-drift-advisor" class="sync-btn">Open Drift Advisor</button>'
        : '';
    return /* html */ `<div class="db-toolbar">
<button type="button" id="btn-db-baseline-a" class="sync-btn">SQL baseline: A → viewer</button>
<button type="button" id="btn-db-baseline-b" class="sync-btn">SQL baseline: B → viewer</button>
<button type="button" id="btn-db-baseline-clear" class="sync-btn">Clear SQL baseline</button>
${driftBtn}
</div>`;
}

function renderLines(lines: readonly DiffLine[], side: 'a' | 'b'): string {
    return lines
        .map((dl, i) => {
            const cls = dl.status === 'unique' ? `unique-${side}` : 'common';
            const text = escapeHtml(dl.line.text);
            return `<div class="line ${cls}" data-idx="${i}">${text}</div>`;
        })
        .join('\n');
}

function renderDbCompareDetectorMarkers(results: readonly DbDetectorResult[]): string {
    const markers = results.filter((r) => r.kind === 'marker');
    if (markers.length === 0) {
        return '';
    }
    const items = markers
        .map((r) => {
            const pl = r.payload as { label?: string; category?: string };
            const label = typeof pl.label === 'string' ? pl.label : '';
            if (!label) {
                return '';
            }
            return `<li class="db-compare-marker-item">${escapeHtml(label)}</li>`;
        })
        .filter(Boolean)
        .join('\n');
    if (!items) {
        return '';
    }
    return /* html */ `<div class="db-compare-markers-wrap" role="region" aria-label="SQL compare detector notes">
<p class="db-fp-hint">Detector highlights (batch compare)</p>
<ul class="db-compare-markers">${items}</ul>
</div>`;
}

function renderDatabaseFingerprintSection(
    db: SessionDbFingerprintCompareResult,
    nameA: string,
    nameB: string,
    dbCompareDetectorResults: readonly DbDetectorResult[],
): string {
    const labelA = escapeHtml(nameA);
    const labelB = escapeHtml(nameB);
    const summaryLine = db.hasDriftSql
        ? `Database (Drift SQL) — ${db.totalStatementsA} exec A / ${db.totalStatementsB} exec B · ${db.distinctFingerprintsA} fp A / ${db.distinctFingerprintsB} fp B`
        : 'Database (Drift SQL)';
    const markersBlock = renderDbCompareDetectorMarkers(dbCompareDetectorResults);
    if (!db.hasDriftSql) {
        return /* html */ `<details class="db-fp-section" open>
<summary>${escapeHtml(summaryLine)}</summary>
${markersBlock}
<p class="db-fp-hint">No <code>Drift: Sent …</code> lines found in these logs (after the session header).</p>
</details>`;
    }
    const rows = db.rows.slice(0, SESSION_DB_FP_COMPARE_MAX_ROWS);
    const more =
        db.rows.length > SESSION_DB_FP_COMPARE_MAX_ROWS
            ? `<p class="db-fp-hint">Showing first ${SESSION_DB_FP_COMPARE_MAX_ROWS} of ${db.rows.length} fingerprint changes (sorted by impact).</p>`
            : '';
    const slowHead = db.hasSlowQueryStats
        ? `<th>Slow A</th>
<th>Slow B</th>
<th>Δ slow</th>
`
        : '';
    const head = /* html */ `<tr>
<th>Change</th>
<th>Fingerprint</th>
<th>${labelA} #</th>
<th>${labelB} #</th>
<th>Δ #</th>
<th>Avg ms A</th>
<th>Avg ms B</th>
<th>Δ avg</th>
${slowHead}<th>Jump</th>
</tr>`;
    const body = rows.map((r) => renderDbFingerprintRow(r, db.hasSlowQueryStats)).join('\n');
    return /* html */ `<details class="db-fp-section" open>
<summary>${escapeHtml(summaryLine)}</summary>
${markersBlock}
<div class="db-fp-table-wrap">
<table class="db-fp-table" aria-label="SQL fingerprint comparison">
${head}
${body}
</table>
</div>
${more}
</details>`;
}

function renderDbFingerprintRow(r: SessionDbFingerprintDiffRow, showSlowColumns: boolean): string {
    const kindLabel = DB_FP_KIND_LABELS[r.kind];
    const kindClass = `db-kind db-kind-${r.kind}`;
    const fpFull = escapeHtml(r.fingerprint);
    let fpShort = fpFull;
    if (r.fingerprint.length > 96) {
        fpShort = `${escapeHtml(r.fingerprint.slice(0, 96))}<span class="db-fp-trunc">…</span>`;
    }
    const avgA = r.avgA === undefined ? '—' : formatFixed(r.avgA, 1);
    const avgB = r.avgB === undefined ? '—' : formatFixed(r.avgB, 1);
    const dAvg = r.avgDeltaMs === undefined ? '—' : formatSignedFixed(r.avgDeltaMs, 1);
    let dCount = '0';
    if (r.countDelta > 0) {
        dCount = `+${r.countDelta}`;
    } else if (r.countDelta < 0) {
        dCount = `${r.countDelta}`;
    }
    const enc = encodeURIComponent(r.fingerprint);
    const jumpA =
        r.countA > 0
            ? `<button type="button" class="db-jump sync-btn" data-side="a" data-fp="${enc}">A</button>`
            : '';
    const jumpB =
        r.countB > 0
            ? `<button type="button" class="db-jump sync-btn" data-side="b" data-fp="${enc}">B</button>`
            : '';
    let jumpCell = '<td class="db-jump-cell">—</td>';
    if (jumpA || jumpB) {
        const gap = jumpA && jumpB ? ' ' : '';
        jumpCell = `<td class="db-jump-cell">${jumpA}${gap}${jumpB}</td>`;
    }
    const slowCells = showSlowColumns
        ? `<td>${r.slowA === undefined ? '—' : r.slowA}</td>
<td>${r.slowB === undefined ? '—' : r.slowB}</td>
<td>${r.slowDelta === undefined ? '—' : formatSignedInt(r.slowDelta)}</td>
`
        : '';
    return /* html */ `<tr>
<td><span class="${kindClass}">${escapeHtml(kindLabel)}</span></td>
<td class="db-fp-fp" title="${fpFull}">${fpShort}</td>
<td>${r.countA}</td>
<td>${r.countB}</td>
<td>${dCount}</td>
<td>${avgA}</td>
<td>${avgB}</td>
<td>${dAvg}</td>
${slowCells}${jumpCell}
</tr>`;
}

function formatSignedInt(n: number): string {
    if (n > 0) {
        return `+${n}`;
    }
    return String(n);
}

function formatFixed(n: number, digits: number): string {
    return n.toFixed(digits);
}

function formatSignedFixed(n: number, digits: number): string {
    const s = n.toFixed(digits);
    return n > 0 ? `+${s}` : s;
}
