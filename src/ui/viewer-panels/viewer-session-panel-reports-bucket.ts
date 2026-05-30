/**
 * Webview-side script for the per-day Reports bucket and the newer-log
 * sticky banner. Inlined into the same IIFE as viewer-session-panel so it
 * shares the IIFE's `sessionDisplayOptions`, `collapsedDays`,
 * `expandedReportBuckets`, `vt`, `escapeAttr`, `escapeHtmlText`, and
 * helper functions like `renderItemsWithGroupBlocks` and
 * `renderDayHeading`.
 *
 * Extracted from viewer-session-panel-rendering.ts to keep that file
 * under the 300-line limit. See [bugs/001_plan-newer-alert-and-reports-grouping.md].
 */

export function getReportsBucketAndBannerScript(): string {
    return /* javascript */ `
    /** Wrap a day heading and its items (run through group-coalescing) in a collapsible container.
     *
     * Project (debug-session) and Report (lint / audit / bundle) rows render into separate
     * blocks inside the same day. The Reports block is itself a collapsible bucket — controlled
     * by sessionDisplayOptions.reportsBucketState ('collapsed' default | 'expanded' | 'hidden')
     * and the per-day override expandedReportBuckets[dateKey]. A day with 0 reports renders
     * exactly as before; a day with 0 projects renders just the Reports bucket. */
    function renderDayGroup(dateKey, dayRecords, bnCounts) {
        var collapsed = !!collapsedDays[dateKey];
        var cls = 'session-day-group' + (collapsed ? ' collapsed' : '');
        var split = partitionReports(dayRecords);
        var projectHtml = renderItemsWithGroupBlocks(split.projects, bnCounts);
        var bucketHtml = renderReportsBucket(dateKey, split.reports, bnCounts);
        return '<div class="' + cls + '" data-day-key="' + escapeAttr(dateKey) + '">'
            + renderDayHeading(dateKey, collapsed, dayRecords.length)
            + '<div class="session-day-items">' + projectHtml + bucketHtml + '</div>'
            + '</div>';
    }

    /** Split a day's records into project and report buckets per the host-classified \`kind\` field. */
    function partitionReports(records) {
        var projects = [], reports = [];
        for (var i = 0; i < records.length; i++) {
            if (records[i] && records[i].kind === 'report') { reports.push(records[i]); }
            else { projects.push(records[i]); }
        }
        return { projects: projects, reports: reports };
    }

    /** Resolve effective bucket state for a day. Per-day expansion override wins; otherwise the panel-wide setting. */
    function reportsBucketStateFor(dateKey) {
        if (expandedReportBuckets && expandedReportBuckets[dateKey]) { return 'expanded'; }
        var s = sessionDisplayOptions && sessionDisplayOptions.reportsBucketState;
        return (s === 'expanded' || s === 'hidden') ? s : 'collapsed';
    }

    /** Render the per-day Reports bucket. Returns '' when there are no reports OR the bucket
     *  is hidden. A single report renders inline (no bucket-of-one). */
    function renderReportsBucket(dateKey, reports, bnCounts) {
        if (!reports || reports.length === 0) return '';
        var state = reportsBucketStateFor(dateKey);
        if (state === 'hidden') return '';
        if (reports.length === 1) return renderItemsWithGroupBlocks(reports, bnCounts);
        var expanded = (state === 'expanded');
        var chev = expanded ? 'codicon-chevron-down' : 'codicon-chevron-right';
        var headLabel = (typeof vt === 'function')
            ? vt('viewer.session.reports.bucketLabel', reports.length)
            : ('Reports (' + reports.length + ')');
        var itemsHtml = renderItemsWithGroupBlocks(reports, bnCounts);
        var bucketCls = 'session-reports-bucket' + (expanded ? '' : ' collapsed');
        return '<div class="' + bucketCls + '" data-bucket-day="' + escapeAttr(dateKey) + '">'
            + '<div class="session-reports-bucket-heading" role="button" tabindex="0" aria-expanded="' + expanded + '">'
            + '<span class="session-reports-bucket-chevron codicon ' + chev + '"></span>'
            + '<span class="session-reports-bucket-label">' + escapeHtmlText(headLabel) + '</span>'
            + '</div>'
            + '<div class="session-reports-bucket-items">' + itemsHtml + '</div>'
            + '</div>';
    }

    /** Newer-log sticky banner. Shown when ANY rendered record has unreadSinceFocus:true.
     *  The banner offers two actions: Open (focuses the newest unread log) and Dismiss
     *  (advances LOGS_PANEL_DISMISSED_AT_KEY host-side so unreadSinceFocus flips off). */
    function renderNewerLogBanner(sorted) {
        var banner = document.getElementById('session-newer-banner');
        if (!banner) return;
        if (!sessionDisplayOptions || sessionDisplayOptions.newerLogBannerEnabled === false) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }
        var unread = (sorted || []).filter(function(s) { return !!(s && s.unreadSinceFocus); });
        if (unread.length === 0) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }
        /* Newest unread = highest mtime among the unread set. Used by both the
           visible label and the Open button's target URI. */
        var newest = unread[0];
        for (var i = 1; i < unread.length; i++) {
            if ((unread[i].mtime || 0) > (newest.mtime || 0)) newest = unread[i];
        }
        var nameRaw = newest.displayName || newest.filename || '';
        var nameDisplay = applySessionDisplayOptions(getSessionBasename(nameRaw));
        var when = newest.relativeTime || newest.formattedTime || newest.formattedMtime || '';
        var text = (unread.length === 1)
            ? (typeof vt === 'function' ? vt('viewer.session.newerBanner.singular', nameDisplay, when) : ('New log · ' + nameDisplay + ' · ' + when))
            : (typeof vt === 'function' ? vt('viewer.session.newerBanner.plural', nameDisplay, when, unread.length - 1) : ('New logs · ' + nameDisplay + ' · ' + when + ' (+' + (unread.length - 1) + ' more)'));
        var openLabel = typeof vt === 'function' ? vt('viewer.session.newerBanner.open') : 'Open';
        var dismissLabel = typeof vt === 'function' ? vt('viewer.session.newerBanner.dismiss') : 'Dismiss';
        banner.innerHTML = '<span class="session-newer-banner-icon codicon codicon-bell"></span>'
            + '<span class="session-newer-banner-text">' + escapeHtmlText(text) + '</span>'
            + '<span class="session-newer-banner-actions">'
            +   '<button type="button" class="session-newer-banner-action primary" data-newer-action="open" data-newer-uri="' + escapeAttr(newest.uriString || '') + '">' + escapeHtmlText(openLabel) + '</button>'
            +   '<button type="button" class="session-newer-banner-action" data-newer-action="dismiss">' + escapeHtmlText(dismissLabel) + '</button>'
            + '</span>';
        banner.style.display = '';
    }
    `;
}
