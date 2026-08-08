/**
 * The report's screenshot gallery (plan 117, Phase E) — split out of `flow-map-html.ts` when the
 * lightbox data attributes pushed that file against the 300-line budget.
 *
 * Every figure carries the same `data-shot-*` facts the diagram thumbnails do, so one lightbox
 * script serves both surfaces without a second data shape to keep in sync.
 */

import { screenKeyOf, type FlowShot } from './flow-map-screenshots';
import type { ShotsByScreen } from './flow-map-svg-shots';
import { stripAnsi } from './flow-map-format';
import { groupShotsByScreen, shotDataAttrs, shotSetAttrs } from './flow-map-svg-shots';
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
function shotFigureHtml(
    shot: FlowShot, index: number, all: readonly FlowShot[], byScreen: ShotsByScreen,
): string {
    // The replay preview pairs figures to diagram nodes by this key (matches the node's data-rowkey).
    const key = shot.screenLabel ? screenKeyOf(stripAnsi(shot.screenLabel)) : '';
    const keyAttr = key ? ` data-screen-key="${esc(key)}"` : '';
    // Compare offers the same set a card thumbnail does — this capture's SCREEN, not the whole
    // gallery. Comparing Home against Settings answers nothing; comparing two Homes is the question.
    // The index is this capture's position within its SCREEN, which is not its gallery position.
    const screenSet = byScreen.get(key) ?? [];
    const siblings = shotSetAttrs(key, screenSet.indexOf(shot), screenSet.length);
    const alt = esc(truncate(stripAnsi(shot.text), 80));
    const screen = shot.screenLabel ? esc(stripAnsi(shot.screenLabel)) : '—';
    const caption = `${esc(shot.clock)} · ${esc(shot.trigger)} · ${screen}`;
    // esc() the URL like the diagram thumbnail does: a webview URI carries no HTML metacharacters
    // today, but the two surfaces render the SAME value and must not diverge on escaping.
    return `<figure class="shot-fig"${keyAttr}><img class="shot-img" role="button" tabindex="0"`
        + `${shotDataAttrs(shot, index + 1, all.length)}${siblings} src="${esc(shot.src)}" alt="${alt}" `
        + `title="${esc(t('flowMap.shot.open'))}"><figcaption class="shot-cap">${caption}</figcaption></figure>`;
}

/** Counts the gallery reports beneath its grid: what the report capped, and what capture dropped. */
export interface ShotGalleryCounts {
    readonly omitted: number;
    readonly suppressed: number;
}

/**
 * Screenshot gallery body: a grid of figures, plus notes for what is NOT shown.
 *
 * Two different absences, reported separately because they mean different things and have different
 * remedies. `omitted` is a rendering cap — those captures exist on disk. `suppressed` is a capture
 * that was never taken, because the near-duplicate rule judged it the same picture as a recent one;
 * saying so is what keeps that setting honest, since a discarded capture is otherwise invisible.
 */
export function screenshotsSectionHtml(shots: readonly FlowShot[], counts: ShotGalleryCounts): string {
    const byScreen = groupShotsByScreen(shots);
    const figures = shots.map((s, i) => shotFigureHtml(s, i, shots, byScreen)).join('');
    const grid = `<div class="shot-grid">${figures}</div>`;
    const more = counts.omitted > 0
        ? `<p class="shot-more">${esc(t('flowMap.shots.more', String(counts.omitted)))}</p>` : '';
    const skipped = counts.suppressed > 0
        ? `<p class="shot-more">${esc(t('flowMap.shots.suppressed', String(counts.suppressed)))}</p>` : '';
    return grid + more + skipped;
}
