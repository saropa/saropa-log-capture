/**
 * Scrollbar Minimap Script — Canvas-based
 *
 * Paints severity markers and search highlights onto a canvas element
 * replacing the native scrollbar. Uses prefixSums from the scroll-anchor
 * system for pixel-accurate positioning.
 *
 * Features:
 * - Level markers: error, warning, performance, to-do, debug, notice, info
 * - Search match and current match markers
 * - Draggable viewport indicator (DOM overlay on canvas)
 * - Click-to-navigate, drag-to-scroll, wheel forwarding
 * - HiDPI canvas rendering
 * - Full-area track tint (theme scrollbar slider); SQL density is full-width bands under severity ticks
 * - Neutral "content presence" strokes when severity groups are empty (e.g. info/debug/notice
 *   hidden via `minimapShowInfoMarkers` and logs are mostly info) so the strip is not an empty canvas
 * - Optional high-contrast red outline on the viewport slider (`minimapViewportRedOutline`)
 * - Optional yellow arrow outside the minimap strip pointing at viewport center (`minimapViewportOutsideArrow`)
 * - Optional VS Code–like horizontal extent per line from text length vs log pane width (`minimapProportionalLines`, default on)
 */
import { getScrollbarMinimapSqlScript } from './viewer-scrollbar-minimap-sql';
import { getScrollbarMinimapStateScript } from './viewer-scrollbar-minimap-state';
import { getScrollbarMinimapPaintScript } from './viewer-scrollbar-minimap-paint';
import { getScrollbarMinimapInjectedScript } from './viewer-scrollbar-minimap-injected';

/** Returns the JavaScript code for the scrollbar minimap in the webview. */
export function getScrollbarMinimapScript(): string {
    return getScrollbarMinimapSqlScript()
        + getScrollbarMinimapStateScript()
        + getScrollbarMinimapPaintScript()
        + getScrollbarMinimapInjectedScript();
}

/** Returns the HTML for the scrollbar minimap element. */
export function getScrollbarMinimapHtml(): string {
    return `<div id="scrollbar-minimap-column" class="scrollbar-minimap-column">
<div id="minimap-outside-arrow" class="minimap-outside-arrow u-hidden" aria-hidden="true"><span class="minimap-outside-arrow-glyph" aria-hidden="true"></span></div>
<div id="scrollbar-minimap" class="scrollbar-minimap" role="img" aria-label="Log scroll map. Click or drag to scroll the log. Short ticks show level and search; optional pink and orange shading shows SQL activity along the log."></div>
</div>`;
}
