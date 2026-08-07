/**
 * The report's screenshot gallery (plan 117, Phase E) — split out of `flow-map-html.ts` when the
 * lightbox data attributes pushed that file against the 300-line budget.
 *
 * Every figure carries the same `data-shot-*` facts the diagram thumbnails do, so one lightbox
 * script serves both surfaces without a second data shape to keep in sync.
 */

import { screenKeyOf, type FlowShot } from './flow-map-screenshots';
import { stripAnsi } from './flow-map-format';
import { shotDataAttrs } from './flow-map-svg-shots';
import { t } from '../../l10n';

/** Escape text for HTML. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Truncate alt/caption text to a readable length without cutting mid-word where avoidable. */
function truncate(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/**
 * One screenshot figure: a thumbnail that opens the lightbox (NOT the log — the lightbox offers the
 * reveal-in-log action itself, so a mis-click no longer scrolls the viewer out from under the reader)
 * plus a clock/trigger/screen caption.
 */
function shotFigureHtml(shot: FlowShot, index: number, all: readonly FlowShot[]): string {
    // The replay preview pairs figures to diagram nodes by this key (matches the node's data-rowkey).
    const keyAttr = shot.screenLabel
        ? ` data-screen-key="${esc(screenKeyOf(stripAnsi(shot.screenLabel)))}"` : '';
    const alt = esc(truncate(stripAnsi(shot.text), 80));
    const screen = shot.screenLabel ? esc(stripAnsi(shot.screenLabel)) : '—';
    const caption = `${esc(shot.clock)} · ${esc(shot.trigger)} · ${screen}`;
    // esc() the data URI like the diagram thumbnail does: base64 carries no HTML metacharacters
    // today, but the two surfaces render the SAME value and must not diverge on escaping.
    return `<figure class="shot-fig"${keyAttr}><img class="shot-img" role="button" tabindex="0"`
        + `${shotDataAttrs(shot, index + 1, all.length)} src="${esc(shot.dataUri)}" alt="${alt}" `
        + `title="${esc(t('flowMap.shot.open'))}"><figcaption class="shot-cap">${caption}</figcaption></figure>`;
}

/** Screenshot gallery body: a grid of figures plus an omitted-count note when the report capped the set. */
export function screenshotsSectionHtml(shots: readonly FlowShot[], omitted: number): string {
    const grid = `<div class="shot-grid">${shots.map((s, i) => shotFigureHtml(s, i, shots)).join('')}</div>`;
    const more = omitted > 0 ? `<p class="shot-more">${esc(t('flowMap.shots.more', String(omitted)))}</p>` : '';
    return grid + more;
}
