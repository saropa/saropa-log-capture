/**
 * Screenshot thumbnails inside flow-diagram nodes. Split out of `flow-map-svg.ts` (which was already
 * near the 300-line budget) and kept pure so the geometry can be unit-tested without a webview.
 *
 * A node shows ONE screenshot from that screen — the error capture when there is one, else the first
 * (see `pickThumbShot`) — plus a count pill when the screen was captured more than once. Only the
 * shown shot's data URI is embedded per node — repeating every
 * capture's base64 in the diagram would multiply the panel HTML weight by the capture count for no
 * extra information at thumbnail size (the gallery and the lightbox still reach the whole set).
 *
 * Known cost: in the main report the shown capture's bytes ship TWICE — once here and once in the
 * gallery figure — so a session with N captured screens carries N extra copies. Static HTML has no
 * way to share one payload between an SVG `<image>` and an `<img>`, and the alternative (the diagram
 * borrowing the gallery's img at runtime) would leave the pop-out, which renders no gallery, with
 * blank cards. The report cap of 12 captures bounds the total either way. The pop-out itself pays
 * nothing extra — it embeds only the diagram copy.
 */

import type { FlowShot } from './flow-map-screenshots';
import { screenKeyOf } from './flow-map-screenshots';
import { stripAnsi } from './flow-map-format';

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

/** Escape text for an XML/SVG attribute. */
function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
export function shotDataAttrs(shot: FlowShot, index: number, total: number): string {
    return ` data-shot-clock="${esc(shot.clock)}" data-shot-trigger="${esc(shot.trigger)}"`
        + ` data-shot-screen="${esc(stripAnsi(shot.screenLabel ?? ''))}"`
        + ` data-shot-line="${shot.logLine}" data-shot-index="${index}" data-shot-total="${total}"`;
}

/**
 * The thumbnail block for one node: framed capture + optional count pill. `x`/`y` are the node box's
 * top-left. Returns '' when the screen has no captures, so callers can concatenate unconditionally.
 *
 * `xMidYMin slice` fills the frame and crops from the BOTTOM: a phone capture's identifying chrome
 * (app bar, screen title) lives at the top, so keeping the top edge makes the screen recognizable at
 * 148px where a letterboxed "meet" fit would be a sliver with dead space either side. The frame's
 * portrait aspect assumes phone captures; a landscape or tablet capture crops harder, which is a
 * legibility trade, not a defect.
 */
export function thumbMarkup(x: number, y: number, shots: readonly FlowShot[]): string {
    const picked = pickThumbShot(shots);
    if (!picked) { return ''; }
    const { shot, index } = picked;
    const tx = x + THUMB_PAD;
    const ty = y + THUMB_PAD;
    const label = esc(stripAnsi(shot.screenLabel ?? shot.trigger));
    return `<image class="fm-shot" x="${tx}" y="${ty}" width="${THUMB_W}" height="${THUMB_H}" `
        + `preserveAspectRatio="xMidYMin slice" href="${esc(shot.dataUri)}" role="button" tabindex="0" `
        // data-shot-scope="screen": this thumbnail's index/total count THIS SCREEN's captures, while a
        // gallery figure's count the whole session's. Same attributes, different denominator — the
        // lightbox picks its wording from the scope so "1 of 3" never silently means two things. The
        // index is the SHOWN capture's position, which is not always the first one (see pickThumbShot).
        + `aria-label="${label}"${shotDataAttrs(shot, index + 1, shots.length)} data-shot-scope="screen"/>`
        + `<rect class="fm-shot-frame" x="${tx}" y="${ty}" width="${THUMB_W}" height="${THUMB_H}" rx="4" `
        + `fill="none" stroke-width="1"/>`
        + countPill(tx, ty, shots.length, pillClass(shot.trigger));
}
