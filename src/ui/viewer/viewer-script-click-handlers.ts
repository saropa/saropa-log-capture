/**
 * Viewport click event handlers for the log viewer webview.
 * Handles source links, stack headers, N+1 actions, SQL repeat toggles,
 * error badges, URL links, burst markers, and continuation badges.
 * Extracted from viewer-script.ts to keep the file under the line limit.
 */

export function getViewerClickHandlerScript(): string {
    return /* javascript */ `
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
                vscodeApi.postMessage({ type: 'openErrorAnalysis', text: plain, lineIndex: idx });
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
    var header = e.target.closest('.stack-header');
    if (header && header.dataset.gid !== undefined) {
        toggleStackGroup(parseInt(header.dataset.gid));
        return;
    }
    var contBadge = e.target.closest('.cont-badge');
    if (contBadge && contBadge.dataset.contGid !== undefined && typeof toggleContinuationGroup === 'function') {
        toggleContinuationGroup(parseInt(contBadge.dataset.contGid));
        return;
    }
    /* Metadata filter toggle: PID, TID, or tag click in decoration prefix. */
    var metaSpan = e.target.closest('[data-meta-key]');
    if (metaSpan && typeof toggleMetadataFilter === 'function') {
        e.preventDefault();
        e.stopPropagation();
        toggleMetadataFilter(metaSpan.dataset.metaKey, metaSpan.dataset.metaValue);
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
