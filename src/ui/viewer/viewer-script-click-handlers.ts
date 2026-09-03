/**
 * Viewport click event handlers for the log viewer webview.
 * Handles source links, stack headers, N+1 actions, SQL repeat toggles,
 * error badges, URL links, burst markers, and continuation badges.
 * Extracted from viewer-script.ts to keep the file under the line limit.
 */

import { getViewerClickHandlerGroupsScript } from './viewer-script-click-handlers-groups';

export function getViewerClickHandlerScript(): string {
    return getViewerClickHandlerGroupsScript() + /* javascript */ `
if (viewportEl) viewportEl.addEventListener('click', function(e) {
    var badge = e.target.closest('.error-badge-interactive');
    if (badge) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof closeErrorHover === 'function') { closeErrorHover(); }
        var lineEl = badge.closest('[data-idx]');
        if (lineEl) {
            var idx = parseInt(lineEl.dataset.idx, 10);
            var item = allLines[idx];
            if (item) {
                var plain = stripTags(item.html || '');
                /* bug_007: idx is the allLines array position, not the source file's
                   line number — synthetic rows (markers, stack headers, banners) shift
                   the two out of sync. sourceLineNo is the real 1-based FILE line
                   (stamped by stampSourceLineNoOnNewItems), so the host reads the
                   correct source line when extracting/highlighting frames. Fall back
                   to idx+1 only for rows that predate the stamp (e.g. live-only lines
                   with no on-disk source yet). */
                var errAnalysisLineNo = (typeof item.sourceLineNo === 'number') ? item.sourceLineNo : (idx + 1);
                vscodeApi.postMessage({ type: 'openErrorAnalysis', text: plain, sourceLineNo: errAnalysisLineNo });
            }
        }
        return;
    }
    var urlLink = e.target.closest('.url-link');
    if (urlLink) {
        e.preventDefault();
        vscodeApi.postMessage({ type: 'openUrl', url: urlLink.dataset.url || '' });
        return;
    }
    /* ASCII art block collapse: the chevron on the start row toggles the whole
       block (toggleAsciiArtBlock resolves the contiguous range from the row idx).
       Runs early so the click is not consumed by a later whole-row handler. */
    var artToggleEl = e.target.closest('.art-collapse-chevron');
    if (artToggleEl) {
        e.preventDefault();
        e.stopPropagation();
        var artRow = artToggleEl.closest('[data-idx]');
        if (artRow && typeof toggleAsciiArtBlock === 'function') {
            toggleAsciiArtBlock(parseInt(artRow.dataset.idx, 10));
        }
        return;
    }
    var burstMk = e.target.closest('.slow-query-burst-marker[data-anchor-seq]');
    if (burstMk) {
        e.preventDefault();
        e.stopPropagation();
        var asq = parseInt(burstMk.getAttribute('data-anchor-seq') || '', 10);
        if (!isNaN(asq) && typeof scrollToAnchorSeq === 'function') scrollToAnchorSeq(asq);
        return;
    }
    /* N+1 signal row actions (see viewer-data-add.ts + drift-n-plus-one-detector.ts). */
    var n1Action = e.target.closest('.n1-action');
    if (n1Action) {
        e.preventDefault();
        e.stopPropagation();
        var action = n1Action.dataset.action || '';
        if (action === 'focus-db' && typeof soloSourceTag === 'function') {
            soloSourceTag('database');
        } else if (action === 'focus-fingerprint') {
            var fp = n1Action.dataset.fingerprint || '';
            var searchInput = document.getElementById('search-input');
            if (searchInput && fp) {
                searchInput.value = fp;
                if (typeof openSearch === 'function') openSearch();
                if (typeof updateSearch === 'function') updateSearch();
            }
        } else if (action === 'find-static-sources') {
            if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && !staticSqlFromFingerprintEnabled) return;
            var fpSrc = n1Action.dataset.fingerprint || '';
            if (fpSrc && typeof vscodeApi !== 'undefined' && vscodeApi) {
                vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpSrc });
            }
        }
        return;
    }
    var sqlStaticBtn = e.target.closest('.sql-repeat-static-sources');
    if (sqlStaticBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && !staticSqlFromFingerprintEnabled) return;
        var fpStatic = sqlStaticBtn.getAttribute('data-fingerprint') || '';
        if (fpStatic && typeof vscodeApi !== 'undefined' && vscodeApi) {
            vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpStatic });
        }
        return;
    }
    var sqlRepToggle = e.target.closest('.sql-repeat-drilldown-toggle');
    if (sqlRepToggle) {
        e.preventDefault();
        e.stopPropagation();
        var repSeq = parseInt(sqlRepToggle.dataset.seq || '', 10);
        if (!isNaN(repSeq) && typeof toggleSqlRepeatDrilldown === 'function') toggleSqlRepeatDrilldown(repSeq);
        return;
    }
    var link = e.target.closest('.source-link');
    if (link) {
        /* A click that ends a text drag-select whose mouseup happens to land on a
           source link must NOT be hijacked into open-file — the same collapsed-
           selection guard the frame/owner/banner branches already use. Without it,
           selecting a path to copy it instead navigated away (user report
           2026-06-16). A plain click leaves a collapsed selection, so navigation
           still works. */
        var _lsel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
        if (_lsel && !_lsel.isCollapsed) {
            return;
        }
        /* Ctrl/Cmd + click on a path segment routes to FILTER, not open.
           Each .source-link-seg carries its cumulative prefix in
           data-prefix (e.g. "./lib/database/"); we drop that into the
           search input, force filter mode on, and re-run the search so
           the log collapses to lines containing that prefix. Routes
           BEFORE the link-click branch so Ctrl+click never falls through
           to the open-file path that would have opened a split editor. */
        var seg = e.target.closest('.source-link-seg');
        if (seg && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (typeof filterToPathPrefix === 'function') {
                filterToPathPrefix(seg.dataset.prefix || '');
            }
            return;
        }
        e.preventDefault();
        vscodeApi.postMessage({
            type: 'linkClicked',
            path: link.dataset.path || '',
            line: parseInt(link.dataset.line || '1'),
            col: parseInt(link.dataset.col || '1'),
            splitEditor: e.ctrlKey || e.metaKey,
        });
        return;
    }
    /* Markdown heading collapse (plan 051). */
    var mdHeading = e.target.closest('[data-md-section]');
    if (mdHeading && typeof toggleMdSection === 'function') {
        toggleMdSection(parseInt(mdHeading.dataset.mdSection));
        return;
    }
    /* Markdown multi-line comment collapse. */
    var mdComment = e.target.closest('[data-md-comment]');
    if (mdComment && typeof toggleMdComment === 'function') {
        toggleMdComment(parseInt(mdComment.dataset.mdComment));
        return;
    }
    /* JSON brace-pair collapse (plan 051). */
    var jsonNode = e.target.closest('[data-json-section]');
    if (jsonNode && typeof toggleJsonSection === 'function') {
        toggleJsonSection(parseInt(jsonNode.dataset.jsonSection));
        return;
    }
    /* Metadata filter toggle: PID, TID, or tag click in decoration prefix.
     * Must run before .stack-header so keyword clicks inside collapsible
     * headers are not swallowed by the collapse/expand toggle. */
    var metaSpan = e.target.closest('[data-meta-key]');
    if (metaSpan && typeof toggleMetadataFilter === 'function') {
        e.preventDefault();
        e.stopPropagation();
        toggleMetadataFilter(metaSpan.dataset.metaKey, metaSpan.dataset.metaValue);
        return;
    }
    /* Async-gap glyph: toggle inline expansion (icon ↔ "<asynchronous suspension>"
       text). Must run BEFORE .stack-header so a click on the glyph that sits
       inside a stack header row does not also fire the collapse toggle; the
       glyph also lives on stack-frame rows where there is no group handler. */
    var asyncGlyph = e.target.closest('.async-gap-glyph');
    if (asyncGlyph) {
        e.preventDefault();
        e.stopPropagation();
        asyncGlyph.classList.toggle('expanded');
        return;
    }
    /* Whole stack-FRAME row opens its source. The member-first render
       (formatFrameMemberFirst) leaves the member as plain text and floats the
       path link (.frame-lib-src) hard right at opacity 0.6, where a narrow
       sidebar clips it off-screen — so clicking the obvious member name did
       nothing and the trace read as "not clickable / useless" (user report
       2026-06-07). Clicking anywhere on the frame (after the more specific
       branches above: source-link, async-gap glyph, meta tags) now routes to
       the frame's own embedded .source-link. Guarded on a collapsed selection
       so drag-to-select frame text is never hijacked into an open-file. Headers
       (.stack-header, handled below) keep whole-row toggle; their path link
       still opens via the .source-link branch above. */
    var frameRow = e.target.closest('.stack-line');
    if (frameRow && !e.target.closest('.deco-counter-row[data-affordance-kind]')) {
        /* The .deco-counter-row guard mirrors the .stack-header branch below: a
           frame can now carry a reveal chevron for a hidden gap beneath it
           (getDecorationPrefix), handled by the separate peek listener
           (viewer-peek-chevron.ts) on the SAME viewport element. stopPropagation
           there does not stop this sibling listener, so without this guard a
           chevron click would BOTH peek the gap AND open the frame's source. */
        var _fsel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
        if (!_fsel || _fsel.isCollapsed) {
            var frameLink = frameRow.querySelector('.source-link');
            if (frameLink) {
                e.preventDefault();
                vscodeApi.postMessage({
                    type: 'linkClicked',
                    path: frameLink.dataset.path || '',
                    line: parseInt(frameLink.dataset.line || '1'),
                    col: parseInt(frameLink.dataset.col || '1'),
                    splitEditor: e.ctrlKey || e.metaKey,
                });
                return;
            }
        }
    }
    /* Stack-header toggle, stack-owner row toggle, Flutter banner toggle,
       continuation-badge toggle, and Trouble Mode row-open all live in
       handleGroupToggleClicks (viewer-script-click-handlers-groups.ts) —
       moved out to keep this file under the line limit. */
    if (typeof handleGroupToggleClicks === 'function' && handleGroupToggleClicks(e)) {
        return;
    }
});

if (viewportEl) viewportEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var lineEl = e.target.closest('[data-idx]');
    if (!lineEl) return;
    var idx = parseInt(lineEl.dataset.idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= allLines.length) return;
    var rItem = allLines[idx];
    if (!rItem || !rItem.sqlRepeatDrilldown || !rItem.sqlRepeatDrilldownOpen) return;
    e.preventDefault();
    if (typeof toggleSqlRepeatDrilldown === 'function') toggleSqlRepeatDrilldown(rItem.seq);
});
`;
}
