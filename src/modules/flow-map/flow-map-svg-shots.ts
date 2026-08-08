/**
 * Screenshot thumbnails inside flow-diagram nodes. Split out of `flow-map-svg.ts` (which was already
 * near the 300-line budget) and kept pure so the geometry can be unit-tested without a webview.
 *
 * A node shows ONE screenshot from that screen — the error capture when there is one, else the first
 * (see `pickThumbShot`) — plus a count pill when the screen was captured more than once. At 148px a
 * second capture of the same screen adds no information, so the extra ones stay in the gallery and
 * the lightbox.
 *
 * The image source is a `webview.asWebviewUri(...)` URL, not a base64 data URI: the PNGs sit on disk beside
 * the log, so referencing them keeps the panel document a few KB instead of megabytes and lets
 * Chromium load and cache each capture independently. It also means the diagram and the gallery
 * figure of the same capture share ONE fetch rather than shipping the bytes twice.
 */

import type { FlowShot } from './flow-map-screenshots';
import { screenKeyOf } from './flow-map-screenshots';
import { esc, stripAnsi } from './flow-map-format';

/** Horizontal inset of the thumbnail inside the node box (also its top inset). */
export const THUMB_PAD = 10;
/** Thumbnail frame width — node width minus both insets (see `BOX_W` in flow-map-svg.ts). */
export const THUMB_W = 148;
/** Thumbnail frame height. Portrait-ish so phone captures fill the frame instead of letterboxing. */
export const THUMB_H = 176;
/** Gap between the thumbnail's bottom edge and the node's first text line. */
export const THUMB_GAP = 8;

/** Total vertical space a thumbnail block consumes above a node's text lines. */
export const THUMB_BLOCK_H = THUMB_PAD + THUMB_H + THUMB_GAP;

/** Screen key → that screen's captures, in the order they were taken. */
export type ShotsByScreen = ReadonlyMap<string, readonly FlowShot[]>;

/**
 * Group captures by the normalized key of the screen they were taken on, so a node can look its own
 * shots up by `node.key`. Shots with no resolved screen are dropped — they belong to no node.
 */
export function groupShotsByScreen(shots: readonly FlowShot[]): ShotsByScreen {
    const map = new Map<string, FlowShot[]>();
    for (const shot of shots) {
        if (!shot.screenLabel) { continue; }
        const key = screenKeyOf(stripAnsi(shot.screenLabel));
        const list = map.get(key);
        if (list) { list.push(shot); } else { map.set(key, [shot]); }
    }
    return map;
}

/**
 * Fault triggers in precedence order. Both are fault captures — the capturer itself treats them
 * alike (it fingerprint-dedups on error OR warning) — but an error outranks a warning when a screen
 * produced both, because the error is the more likely reason the reader opened this report.
 */
const FAULT_ORDER: readonly FlowShot['trigger'][] = ['error', 'warning'];

/**
 * Which capture represents the screen. A screen captured several times is usually captured BECAUSE
 * something went wrong on it, and the fault capture answers "what did it look like when it broke" —
 * the question a reader opens the flow map with. Falls back to the first capture when none faulted.
 */
export function pickThumbShot(shots: readonly FlowShot[]): { shot: FlowShot; index: number } | undefined {
    if (shots.length === 0) { return undefined; }
    for (const trigger of FAULT_ORDER) {
        const found = shots.findIndex(s => s.trigger === trigger);
        if (found >= 0) { return { shot: shots[found], index: found }; }
    }
    return { shot: shots[0], index: 0 };
}

/** The pill tint for the capture on show: its own severity, or none for a routine capture. */
function pillClass(trigger: FlowShot['trigger']): string {
    // The tint makes the pill say more than "3 captures" — it says "3 captures, and the one you are
    // looking at is the one that faulted", at the severity that actually fired.
    if (trigger === 'error') { return 'fm-shot-pill fm-shot-pill-alert'; }
    if (trigger === 'warning') { return 'fm-shot-pill fm-shot-pill-warn'; }
    return 'fm-shot-pill';
}

/** The count pill on a multi-capture thumbnail (bottom-right). Omitted for a single capture. */
function countPill(x: number, y: number, count: number, cls: string): string {
    if (count < 2) { return ''; }
    const text = String(count);
    // Grow with the digit count so a three-digit run does not overflow the pill's rounded ends.
    const w = 16 + text.length * 7;
    const px = x + THUMB_W - w - 6;
    const py = y + THUMB_H - 22;
    return `<rect class="${cls}" x="${px}" y="${py}" width="${w}" height="16" rx="8"/>`
        + `<text class="fm-shot-pill-text" x="${px + w / 2}" y="${py + 8}" text-anchor="middle" `
        + `dominant-baseline="central" font-size="10.5" font-weight="700" `
        + `font-family="var(--vscode-font-family)">${text}</text>`;
}

/**
 * Facts the lightbox reads off a clicked capture. The single source of these attribute names: the
 * gallery figures (`flow-map-html-shots.ts`) import this so a figure and its diagram thumbnail can
 * never drift into describing the same capture differently.
 */
/**
 * Where a capture sits in its screen's set, for the lightbox's compare view: the screen's key and
 * this capture's index within that screen's captures.
 *
 * Deliberately a POINTER, not the set itself. Inlining every screen's set on every element of that
 * screen makes the markup grow with the square of a screen's capture count — fine at the current
 * 12-capture report cap, and quietly not fine the moment that cap is raised. The set is emitted once
 * per document by `shotSetsIsland`.
 *
 * Omitted for a lone capture: there is nothing to compare it against, and the compare control keys
 * off this attribute's absence.
 */
export function shotSetAttrs(screenKey: string, index: number, total: number): string {
    if (total < 2 || !screenKey) { return ''; }
    return ` data-shot-screen-key="${esc(screenKey)}" data-shot-sib="${index}"`;
}

/**
 * Every multi-capture screen's set, emitted ONCE per document as an inert data island the compare
 * view reads. A `<div hidden data-…>` rather than a `<script type="application/json">` because the
 * panel's CSP admits scripts only by nonce, and an inert element sidesteps that question entirely.
 */
export function shotSetsIsland(byScreen: ShotsByScreen): string {
    const sets: Record<string, { src: string; clock: string; trigger: string }[]> = {};
    for (const [key, list] of byScreen) {
        if (list.length < 2) { continue; }
        sets[key] = list.map(s => ({ src: s.src, clock: s.clock, trigger: s.trigger }));
    }
    if (Object.keys(sets).length === 0) { return ''; }
    return `<div id="fm-shot-sets" hidden data-sets="${esc(JSON.stringify(sets))}"></div>`;
}

export function shotDataAttrs(shot: FlowShot, index: number, total: number): string {
    return ` data-shot-clock="${esc(shot.clock)}" data-shot-trigger="${esc(shot.trigger)}"`
        + ` data-shot-screen="${esc(stripAnsi(shot.screenLabel ?? ''))}"`
        // The on-disk path, not the fetch URL: the lightbox shows the filename and copies this whole
        // string, which is what a reader pastes into a terminal or a bug report.
        + ` data-shot-path="${esc(shot.path)}"`
        + ` data-shot-line="${shot.logLine}" data-shot-index="${index}" data-shot-total="${total}"`;
}

/** The XHTML namespace a `<foreignObject>` child must declare to survive XML parsing. */
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * The thumbnail block for one node: framed capture + optional count pill. `x`/`y` are the node box's
 * top-left. Returns '' when the screen has no captures, so callers can concatenate unconditionally.
 *
 * WHY THE THUMBNAILS WERE BLANK — corrected. An earlier note here blamed the element (SVG `<image>`
 * vs this `<img>`); that was wrong, and a Playwright render of this exact markup shows an SVG
 * `<image>` painting perfectly well. The real cause was CSS: the palette rules were written as
 * DESCENDANT selectors (`.fm-p-walked rect { fill: … }`), so they also matched `.fm-shot-frame` —
 * a sibling rect in the same node group, drawn AFTER the capture — and a CSS `fill` overrides that
 * rect's `fill="none"` presentation attribute. Every card was painting its own node color straight
 * over its screenshot. The fix is `class="fm-box"` on the node's own rect plus `rect.fm-box` in
 * every palette/hover/animation selector. Keep it that way: one new bare `rect` descendant rule in
 * this panel's stylesheet reintroduces the bug for every card at once.
 *
 * The `<img>` stays because it makes the diagram and the gallery one element type served by one
 * lightbox binder — a simplification, not the fix.
 *
 * `object-fit: cover` + `object-position: top` (in the stylesheet) reproduces what
 * `preserveAspectRatio="xMidYMin slice"` did: fill the frame and crop from the BOTTOM, because a
 * phone capture's identifying chrome (app bar, screen title) lives at the top and a letterboxed fit
 * would be a sliver with dead space either side at 148px. The portrait frame assumes phone captures;
 * a landscape or tablet capture crops harder, which is a legibility trade, not a defect.
 */
export function thumbMarkup(x: number, y: number, shots: readonly FlowShot[], screenKey = ''): string {
    const picked = pickThumbShot(shots);
    if (!picked) { return ''; }
    const { shot, index } = picked;
    const tx = x + THUMB_PAD;
    const ty = y + THUMB_PAD;
    const label = esc(stripAnsi(shot.screenLabel ?? shot.trigger));
    // Hover title answers "why THIS capture?" — a card shows one of several, chosen by trigger, and
    // without the clock and trigger the reader has no way to tell which one they are looking at.
    // Same `clock · trigger · screen` wording (and same untranslated trigger word) as the gallery
    // caption, so the two surfaces describe one capture identically.
    const title = esc(`${shot.clock} · ${shot.trigger} · ${stripAnsi(shot.screenLabel ?? shot.trigger)}`);
    return `<foreignObject x="${tx}" y="${ty}" width="${THUMB_W}" height="${THUMB_H}">`
        + `<img xmlns="${XHTML_NS}" class="fm-shot" src="${esc(shot.src)}" role="button" tabindex="0" `
        + `title="${title}" alt="${label}" `
        // data-shot-scope="screen": this thumbnail's index/total count THIS SCREEN's captures, while a
        // gallery figure's count the whole session's. Same attributes, different denominator — the
        // lightbox picks its wording from the scope so "1 of 3" never silently means two things. The
        // index is the SHOWN capture's position, which is not always the first one (see pickThumbShot).
        + `aria-label="${label}"${shotDataAttrs(shot, index + 1, shots.length)}`
        + `${shotSetAttrs(screenKey, index, shots.length)} data-shot-scope="screen"/>`
        + `</foreignObject>`
        // Drawn AFTER the foreignObject so the hairline frame sits on top of the capture, and kept as
        // SVG so it scales with the diagram's zoom exactly like every other stroke.
        + `<rect class="fm-shot-frame" x="${tx}" y="${ty}" width="${THUMB_W}" height="${THUMB_H}" rx="4" `
        + `fill="none" stroke-width="1"/>`
        + countPill(tx, ty, shots.length, pillClass(shot.trigger));
}
