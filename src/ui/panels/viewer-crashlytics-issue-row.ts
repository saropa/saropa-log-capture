/**
 * Webview-side rendering of a single Crashlytics issue row.
 *
 * Extracted from viewer-crashlytics-panel.ts to keep that file under the 300-LOC limit. The returned
 * string is concatenated into the panel script, so it runs in the same webview scope and relies on the
 * shared globals `esc` and `vt` defined there.
 */

/** Generate the `renderIssue` / version / release-date helpers as a webview script fragment. */
export function getCrashlyticsIssueRowScript(): string {
    return /* js */ `
    function renderIssue(issue) {
        // Pill badge by kind: icon + short label, themed via tokens (UI #2/#3). ⊗ crash, ⏱ ANR, ⚠ non-fatal.
        var kindBadge = { crash: ['\\u2297', 'Crash', 'cp-badge-crash'], anr: ['\\u23F1', 'ANR', 'cp-badge-anr'], nonfatal: ['\\u26A0', 'Non-fatal', 'cp-badge-nf'] };
        var kb = kindBadge[issue.kind] || (issue.isFatal ? kindBadge.crash : kindBadge.nonfatal);
        var badge = '<span class="cp-badge ' + kb[2] + '">' + kb[0] + ' ' + kb[1] + '</span>';
        var state = issue.state !== 'UNKNOWN'
            ? ' <span class="cp-badge cp-badge-' + issue.state.toLowerCase() + '">' + esc(issue.state) + '</span>' : '';
        // Locally-derived "Repetitive" tag (recurs across >1 app version); the API has no such signal.
        var rep = issue.repetitive
            ? ' <span class="cp-badge cp-badge-repetitive" title="' + vt('viewer.crashlytics.badge.repetitiveTip') + '">' + vt('viewer.crashlytics.badge.repetitive') + '</span>' : '';
        // Locally-derived "Regressed" tag (gone in the previous scan, back now); also not in the API.
        var regr = issue.regressed
            ? ' <span class="cp-badge cp-badge-regressed" title="' + vt('viewer.crashlytics.badge.regressedTip') + '">' + vt('viewer.crashlytics.badge.regressed') + '</span>' : '';
        var users = issue.userCount > 0
            ? ' \\u00b7 ' + vt(issue.userCount !== 1 ? 'viewer.crashlytics.usersMany' : 'viewer.crashlytics.usersOne', issue.userCount) : '';
        var ver = formatVersionRange(issue);
        var rel = formatReleaseDate(issue);
        // Close/mute removed: the Play Reporting data source is read-only, so those actions were
        // no-ops (bug_008 / plan 054). The dashboard's "Open Firebase Console" link is the way to
        // act on an issue.
        // The whole row opens the detail in the viewer's main area; ↗ hints it opens a full view.
        // data-* carry the detail-header/markdown fields AND drive the sidebar's client-side filters.
        var sevClass = issue.isFatal ? 'cp-item-fatal' : 'cp-item-nonfatal';
        if (issue.archived) sevClass += ' cp-item-archived';
        var versions = [];
        if (issue.firstVersion) versions.push(issue.firstVersion);
        if (issue.lastVersion && issue.lastVersion !== issue.firstVersion) versions.push(issue.lastVersion);
        // Derived release dates (undefined when the versionCode is not date-encoded) drive the date filter.
        var reldates = [];
        if (issue.firstReleaseDate) reldates.push(issue.firstReleaseDate);
        if (issue.lastReleaseDate && issue.lastReleaseDate !== issue.firstReleaseDate) reldates.push(issue.lastReleaseDate);
        var searchText = (issue.title + ' ' + issue.subtitle).toLowerCase();
        // Archive / unarchive toggle (local view filter — the Play API is read-only). stopPropagation
        // in the click handler stops it from also opening the issue detail.
        var arch = issue.archived ? '1' : '0';
        var archiveBtn = '<button class="cp-archive-btn" data-archived="' + arch + '" title="'
            + vt(issue.archived ? 'viewer.crashlytics.unarchive' : 'viewer.crashlytics.archive') + '" aria-label="'
            + vt(issue.archived ? 'viewer.crashlytics.unarchive' : 'viewer.crashlytics.archive') + '">'
            + '<span class="codicon codicon-' + (issue.archived ? 'inbox' : 'archive') + '"></span></button>';
        return '<div class="cp-item ' + sevClass + '" data-issue-id="' + esc(issue.id) + '" title="' + vt('viewer.crashlytics.openDetail') + '"'
            + ' data-title="' + esc(issue.title) + '" data-sub="' + esc(issue.subtitle) + '"'
            + ' data-events="' + esc(String(issue.eventCount)) + '" data-users="' + esc(String(issue.userCount)) + '"'
            + ' data-fatal="' + (issue.isFatal ? '1' : '0') + '" data-fv="' + esc(issue.firstVersion || '') + '" data-lv="' + esc(issue.lastVersion || '') + '"'
            + ' data-kind="' + esc(issue.kind || 'unknown') + '" data-state="' + esc(issue.state || 'UNKNOWN') + '" data-versions="' + esc(versions.join(',')) + '" data-reldates="' + esc(reldates.join(',')) + '" data-search="' + esc(searchText) + '" data-archived="' + arch + '">'
            + '<div class="cp-title">' + badge + state + regr + rep + ' ' + esc(issue.title) + ' <span class="cp-expand-icon">\\u2197</span>' + archiveBtn + '</div>'
            + '<div class="cp-meta">' + esc(issue.subtitle) + ' \\u00b7 ' + vt('viewer.crashlytics.events', issue.eventCount) + users + ver + rel + '<span class="cp-trend"></span></div></div>';
    }

    /* Subdued derived-release-date label appended to the meta line; tooltip notes it comes from the
       versionCode. Empty when the code is not date-encoded so non-date versions read unchanged. */
    function formatReleaseDate(issue) {
        var first = issue.firstReleaseDate, last = issue.lastReleaseDate;
        if (!first && !last) return '';
        var label = (first && last && first !== last) ? (esc(first) + ' \\u2192 ' + esc(last)) : esc(first || last);
        return ' \\u00b7 <span class="cp-reldate" title="' + vt('viewer.crashlytics.releaseDateTip') + '">' + label + '</span>';
    }

    function formatVersionRange(issue) {
        if (!issue.firstVersion && !issue.lastVersion) return '';
        var range = issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion
            ? esc(issue.firstVersion) + ' \\u2192 ' + esc(issue.lastVersion)
            : esc(issue.firstVersion || issue.lastVersion || '');
        return ' \\u00b7 ' + range;
    }
`;
}
