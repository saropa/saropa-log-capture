/**
 * renderItem() for the log viewer — item-to-HTML rendering.
 * Extracted to keep viewer-data-helpers.ts under the line limit.
 *
 * Severity coloring on device lines is handled by the tier system:
 * - Device-other lines have their level demoted to `info` at capture in `addToData()`,
 *   so they never show red/yellow regardless of logcat prefix.
 * - Device-critical lines keep their real severity (e.g. `E/AndroidRuntime` shows red).
 * The severity gutter always uses `level-bar-{item.level}` so dot/connector color matches text.
 */

import {
  VIEWER_RENDER_EMBED_MARKER_BURST_EDGE,
} from "./viewer-data-helpers-render-db-ts-burst-snips";
import { VIEWER_RENDER_EMBED_RUN_SEPARATOR } from "./viewer-data-helpers-render-run-separator-snip";
import { getViewerDataHelpersRenderLineScript } from "./viewer-data-helpers-render-line";

export function getViewerDataHelpersRender(): string {
    return getViewerDataHelpersRenderLineScript() + /* javascript */ `
/* getCategoryBadge / categoryBadgeColors / showCategoryBadges moved to
   viewer-deco-content.ts (plan 055) to keep this file under the 300-LOC cap.
   They remain global in the shared webview scope, so renderItem still calls
   getCategoryBadge() below. */
function renderItem(item, idx, prevVis) {
    var idxAttr = ' data-idx="' + idx + '"';
    /* Structured file formatting (plan 051): when format toggle is on for
       a non-log file, delegate to the mode-specific formatter. */
    if (fileMode !== 'log' && formatEnabled && item.type === 'line') {
        var fmtHtml = '';
        if (fileMode === 'markdown' && typeof formatMarkdownLine === 'function') fmtHtml = formatMarkdownLine(item, idx);
        else if (fileMode === 'json' && typeof formatJsonLine === 'function') fmtHtml = formatJsonLine(item, idx);
        else if (fileMode === 'csv' && typeof formatCsvLine === 'function') fmtHtml = formatCsvLine(item, idx);
        else fmtHtml = item.html;
        /* Same .line.line-blank quarter-height as plain log mode (viewer-styles-decoration-bars). */
        var _fmtBlank = typeof isLineContentBlank === 'function' && isLineContentBlank(item);
        var _fmtBlankCls = _fmtBlank ? ' line-blank' : '';
        /* Markdown headings: tag the line with its level (CSS sizes/centers the text) and
           pin the row to its computed height so the taller heading row matches the scroll
           math calcItemHeight() produced — block-flow rows derive position from real DOM
           height, so an unpinned heading would drift the prefix sums. */
        /* Markdown heading class + pinned height + line-number/type gutter are built in the
           markdown module (mdLineDecorate) so this generic renderer stays format-agnostic. */
        var _md = (fileMode === 'markdown' && typeof mdLineDecorate === 'function') ? mdLineDecorate(item, idx) : { cls: '', style: '', gutter: '' };
        return '<div class="line fmt-' + fileMode + _fmtBlankCls + _md.cls + (_md.gutter ? ' md-has-gutter' : '') + '"' + idxAttr + _md.style + '>' + _md.gutter + fmtHtml + '</div>';
    }
    var rawHtml = item.html;
    /* Structured line parsing: strip the detected prefix (timestamp, PID, TID, level, tag).
       When active, this subsumes source-tag stripping for structured formats.
       parseStructuredPrefix already accounts for leading [bracket] pairs
       (e.g. [11:49:55.128] [logcat]) in the prefixLen, so one stripHtmlPrefix
       call removes brackets + structured prefix together. */
    if (typeof structuredLineParsing !== 'undefined' && structuredLineParsing && item.structuredPrefixLen > 0) {
        rawHtml = (typeof stripHtmlPrefix === 'function') ? stripHtmlPrefix(rawHtml, item.structuredPrefixLen) : rawHtml;
        /* Strip ALL app-emitted head tags from the structured branch — they will be rendered
           as chips in the tag column (via headTags). Both severity-only tags ([perf], [warn])
           and descriptive tags ([frame-stall], [db]) are removed from the text. */
        if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && (item.sourceTag || (item.headTags && item.headTags.length > 0))) {
            rawHtml = rawHtml.replace(/^(?:\\[[^\\]]+\\]\\s?)+/, '');
        }
    } else if (typeof stripSourceTagPrefix !== 'undefined' && stripSourceTagPrefix && (item.sourceTag || (item.headTags && item.headTags.length > 0))) {
        /* Strip ALL leading [bracket] pairs — DAP adapters may prepend multiple
           (e.g. [11:49:55.128] [stdout]), and app-emitted head tags are rendered
           as chips in the tag column instead of inline text. */
        rawHtml = rawHtml.replace(/^(?:\\[[^\\]]+\\]\\s?)+/, '');
    }
    var html = (typeof highlightSearchInHtml === 'function') ? highlightSearchInHtml(rawHtml) : rawHtml;
    var matchCls = (typeof isCurrentMatch === 'function' && isCurrentMatch(idx)) ? ' current-match'
        : (typeof isSearchMatch === 'function' && isSearchMatch(idx)) ? ' search-match' : '';
    var spacingCls = '';
    if (typeof visualSpacingEnabled !== 'undefined' && visualSpacingEnabled && !item.artBlockPos) {
        var spPrev = null;
        if (prevVis !== undefined) { spPrev = prevVis; }
        else {
            for (var sp = idx - 1; sp >= 0; sp--) {
                if (allLines[sp].height > 0) { spPrev = allLines[sp]; break; }
            }
        }
        if (item.type === 'marker') {
            if (spPrev) spacingCls += ' spacing-before';
            spacingCls += ' spacing-after';
        } else if (item.isContextFirst) {
            // No spacing-before for context lines; gap goes after the error instead
        } else if (item.type === 'stack-header' && item.frameCount > 1) {
            // Multi-frame stack-header: separate visually from a preceding non-stack line.
            // Single-frame synthesized stack-headers (Dart Trace.toString() with one frame)
            // fall through to the next branch and get the same level-transition spacing
            // as a normal log line — they are rendered through the regular .line path
            // (see the frameCount > 1 guard on the renderStackHeader dispatch below).
            if (spPrev && spPrev.type !== 'stack-frame' && spPrev.type !== 'stack-header') spacingCls += ' spacing-before';
        } else if (item.type !== 'stack-frame' && item.type !== 'repeat-notification' && item.type !== 'n-plus-one-signal') {
            if (spPrev && spPrev.type !== 'marker') {
                if (item.level && spPrev.level && item.level !== spPrev.level) spacingCls += ' spacing-before';
                else if (item.isSeparator && !spPrev.isSeparator) spacingCls += ' spacing-before';
            }
        }
        // Add spacing after lines that end a context group (target of filtered level)
        if (!item.isContext && item.type !== 'marker' && spPrev && spPrev.isContext) {
            spacingCls += ' spacing-after';
        }
    }
    if (item.type === 'marker') {
        /* Collapsed runs: markerCollapseCount > 1 → title tooltip (048 / unified collapsing). */
        var _mkTitle = (item.markerCollapseCount && item.markerCollapseCount > 1)
            ? ' title="' + vt('viewer.marker.collapsed', item.markerCollapseCount) + '"'
            : '';
` +
        VIEWER_RENDER_EMBED_MARKER_BURST_EDGE +
        /* javascript */ `
        return '<div class="marker' + (item.appStart ? ' app-start-marker' : '') + _burstEdgeCls + spacingCls + '"' + idxAttr + _mkTitle + '>' + html + '</div>';
    }
` +
        VIEWER_RENDER_EMBED_RUN_SEPARATOR +
        /* javascript */ `
    if (item.type === 'repeat-notification' || item.type === 'n-plus-one-signal') {
        // Defense in depth: applyLevelFilter now skips these as context anchors so they
        // shouldn't reach this branch with isContext=true, but apply the mute anyway so
        // any future code path that flips isContext on a chip renders consistently.
        var chipCtxCls = item.isContext ? ' context-line' + (item.isContextFirst ? ' context-first' : '') : '';
        /* Tabular-column alignment: when decorations are globally on, push chip
           rows to the same content column as decorated lines via the spacer-only
           class. No real prefix is rendered (chip rows have no meaningful
           per-line counter/timestamp to display), but the CSS rule reserves
           padding-left so the chip label and any embedded drilldown panel sit
           in the same column as message text on regular lines. */
        var chipDecoCls = (typeof areDecorationsOn === 'function' && areDecorationsOn()) ? ' line-deco-spacer-only' : '';
        /* When the SQL repeat drilldown is expanded, the .line embeds a block
           <div class="sql-repeat-drilldown-detail"> child. Block children
           overflow the .line's strict 1em height and visually overlap
           subsequent rows. line-has-block flips height to auto so the row
           grows to fit the panel — matches the larger value calcItemHeight()
           returns for this case. */
        var chipBlockCls = item.sqlRepeatDrilldownOpen ? ' line-has-block' : '';
        return '<div class="line' + matchCls + chipCtxCls + chipDecoCls + chipBlockCls + '"' + idxAttr + '>' + html + '</div>';
    }
    /* Stack-gutter-spacer retired. It existed to compensate for the OLD
       inline .stack-toggle ▶ chevron on stack-header rows (regular rows
       got an invisible-▶ spacer of the same width to keep columns aligned).
       Now the chevron lives in the counter-row column on BOTH stack-headers
       AND regular rows, so any compensating spacer would be a one-sided
       shift — and was exactly the cause of "_StringStackTrace doesn't align
       with the message column" the user kept reporting. */
    var stackGutter = '';
    var isBlank = isLineContentBlank(item);
    var barCls = '';
    // Blank lines get no bar class here; the connector bridge in renderViewport() adds the
    // correct level-bar-* when the blank sits between two same-level dots.
    if (typeof decoShowBar !== 'undefined' && decoShowBar && !item.isContext && !isBlank && item.level) {
        if (item.recentErrorContext && item.level === 'error') {
            barCls = ' level-bar-error-recent-context';
        } else {
            barCls = ' level-bar-' + item.level;
        }
    }
    /* Stack-header/stack-frame dispatch, the AI-category line, and the regular
       .line render all live in renderNonMarkerLine (viewer-data-helpers-render-line.ts) —
       moved out to keep this file under the line limit. */
    return renderNonMarkerLine(item, idx, idxAttr, html, matchCls, spacingCls, barCls, stackGutter, isBlank);
}
`;
}
