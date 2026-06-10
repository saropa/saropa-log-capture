/**
 * Webview-side Controller-rooted day grouping for the Logs panel.
 *
 * Replaces the old "project rows + per-day Reports bucket" split. Within a day the tree is now:
 *
 *   Day → Controller (the workspace's own session) → Peripherals (lint / translate / advisor …)
 *
 * A peripheral attaches to the nearest EARLIER controller (the controller with the greatest mtime
 * that is still ≤ the peripheral's own mtime, same day) — "this report came out of that run". A
 * peripheral with no earlier controller renders flat at the bottom of the day ("orphan"). Roles
 * come from the host `role` field (classifySessionRole). When role data is absent every unit is a
 * peripheral, so the day degrades to a flat list — the same shape as before this feature.
 *
 * Inlined into the same IIFE as viewer-session-panel, so it shares `renderItem`,
 * `renderItemsWithGroupBlocks`, `renderDayHeading`, `escapeAttr`, `escapeHtmlText`, `vt`,
 * `sessionDisplayOptions`, `collapsedDays`, `collapsedControllers`, and `expandedOlderNames`.
 *
 * Extracted from viewer-session-panel-rendering.ts to keep both files under the 300-line limit.
 * See [plans/history/2026.06/2026.06.09/controller-rooted-session-tree.md].
 */

export function getControllerGroupingScript(): string {
    return /* javascript */ `
    /** A "unit" coalesces a real session-group (rows sharing a groupId) into one logical node so
     *  controller attach + latest-collapse operate on the session, not its individual files. A
     *  non-grouped record is a unit of one. groupId members are bucketed (not assumed consecutive)
     *  because the day's rows are sorted by mtime and a group's members can be split by other rows. */
    function buildSessionUnits(records) {
        var units = [], byGid = {};
        for (var i = 0; i < records.length; i++) {
            var r = records[i];
            if (!r) continue;
            if (r.groupId) {
                var u = byGid[r.groupId];
                if (!u) { u = { records: [], primary: null, groupId: r.groupId }; byGid[r.groupId] = u; units.push(u); }
                u.records.push(r);
                /* Prefer the host-flagged primary; fall back to first-seen so a unit always has one. */
                if (r.isGroupPrimary || !u.primary) u.primary = r;
            } else {
                units.push({ records: [r], primary: r, groupId: null });
            }
        }
        for (var j = 0; j < units.length; j++) finalizeUnit(units[j]);
        return units;
    }

    /** Lift the render-relevant fields off a unit's primary record so callers read them directly. */
    function finalizeUnit(u) {
        var p = u.primary || u.records[0];
        u.primary = p;
        u.role = (p && p.role === 'controller') ? 'controller' : 'peripheral';
        u.mtime = p ? (p.mtime || 0) : 0;
        u.canon = p ? p._canonName : '';
        u.latest = !!(p && p.isLatestOfName);
        u.older = p ? (p._olderCount || 0) : 0;
    }

    /** Split units into controller blocks (each carrying its attached peripherals) + orphans.
     *  Units arrive in descending-mtime order; the nearest-earlier search is an O(controllers)
     *  scan per peripheral — fine for a single day's rows. */
    function attachUnits(units) {
        var controllers = [], peripherals = [];
        for (var i = 0; i < units.length; i++) {
            if (units[i].role === 'controller') { units[i].children = []; controllers.push(units[i]); }
            else peripherals.push(units[i]);
        }
        var orphans = [];
        for (var p = 0; p < peripherals.length; p++) {
            var per = peripherals[p], best = null;
            for (var k = 0; k < controllers.length; k++) {
                var ctl = controllers[k];
                /* Nearest EARLIER controller: latest start time that is still at or before this
                   peripheral. Ties (same mtime) keep the first scanned — order is irrelevant then. */
                if (ctl.mtime <= per.mtime && (!best || ctl.mtime > best.mtime)) best = ctl;
            }
            if (best) best.children.push(per); else orphans.push(per);
        }
        return { controllers: controllers, orphans: orphans };
    }

    /** "Latest only" no longer hard-filters: it keeps the latest unit of each name plus any name the
     *  user expanded via its "+N older" badge. Off → every unit passes. The hidden older units stay
     *  reachable through that badge rather than vanishing without a trace. */
    function visibleUnits(units) {
        if (!sessionDisplayOptions.showLatestOnly) return units;
        var out = [];
        for (var i = 0; i < units.length; i++) {
            var u = units[i];
            // "Latest only" thins peripheral logs only. A Controller is the project's own session
            // (e.g. "contacts") — every run of it stays visible, never folded behind "+N older".
            // Controllers are exempt whether grouped or not; the filter applies to peripherals only.
            if (u.role === 'controller' || u.latest || (u.canon && expandedOlderNames[u.canon])) out.push(u);
        }
        return out;
    }

    /** Render one peripheral/orphan unit. A grouped unit (real session-group) keeps its own
     *  chevron + member chrome via renderItemsWithGroupBlocks; a unit of one renders a plain row. */
    function renderUnit(u, bnCounts) {
        return renderItemsWithGroupBlocks(u.records, bnCounts);
    }

    /** Controller header row: the controller's primary rendered with a controller chevron + a
     *  "+N" badge counting its attached peripherals. Extra members of the controller's own
     *  session-group (if any) are appended into the children container so nothing is dropped. */
    function renderControllerBlock(ctl, bnCounts) {
        var key = 'ctrl:' + (ctl.primary.uriString || ctl.primary.filename || '');
        var collapsed = !!collapsedControllers[key];
        var header = renderControllerHeader(ctl, collapsed, ctl.children.length, bnCounts);
        var childrenHtml = renderControllerOwnMembers(ctl, bnCounts);
        var childUnits = visibleUnits(ctl.children);
        for (var i = 0; i < childUnits.length; i++) childrenHtml += renderUnit(childUnits[i], bnCounts);
        return '<div class="session-controller-group" data-controller-key="' + escapeAttr(key) + '" data-collapsed="' + (collapsed ? 'true' : 'false') + '">'
            + header
            + '<div class="session-controller-children">' + childrenHtml + '</div>'
            + '</div>';
    }

    /** The controller's own session-group siblings (when it is a multi-file group) render as
     *  indented child rows so the run's logcat/sidecars stay attached to it. */
    function renderControllerOwnMembers(ctl, bnCounts) {
        if (!ctl.records || ctl.records.length < 2) return '';
        var rest = [];
        for (var i = 0; i < ctl.records.length; i++) { if (ctl.records[i] !== ctl.primary) rest.push(ctl.records[i]); }
        return rest.length ? renderItemsWithGroupBlocks(rest, bnCounts) : '';
    }

    function renderControllerHeader(ctl, collapsed, childCount, bnCounts) {
        var p = {};
        for (var k in ctl.primary) p[k] = ctl.primary[k];
        p._groupRole = 'controller';
        p._ctrlCollapsed = collapsed;
        p._ctrlChildCount = childCount;
        return renderItem(p, bnCounts);
    }

    /** Controller blocks (newest first) each carrying their peripherals, then orphans (earliest-of-day
     *  peripherals with no preceding controller) last. Shared by the day-grouped and flat renderers
     *  so "Latest only" collapse and controller nesting behave identically with day headings on or off.
     *  In flat mode the whole list is treated as one pseudo-day for the nearest-earlier attach. */
    function renderControllerList(records, bnCounts) {
        var attached = attachUnits(buildSessionUnits(records));
        var html = '';
        var ctls = visibleUnits(attached.controllers);
        for (var i = 0; i < ctls.length; i++) html += renderControllerBlock(ctls[i], bnCounts);
        var orphans = visibleUnits(attached.orphans);
        for (var j = 0; j < orphans.length; j++) html += renderUnit(orphans[j], bnCounts);
        return html;
    }

    /** Replaces the old reports-bucket renderDayGroup: wraps one day's controller list in the
     *  collapsible day-heading chrome. */
    function renderDayGroup(dateKey, dayRecords, bnCounts) {
        var collapsed = !!collapsedDays[dateKey];
        var cls = 'session-day-group' + (collapsed ? ' collapsed' : '');
        return '<div class="' + cls + '" data-day-key="' + escapeAttr(dateKey) + '">'
            + renderDayHeading(dateKey, collapsed, dayRecords.length)
            + '<div class="session-day-items">' + renderControllerList(dayRecords, bnCounts) + '</div>'
            + '</div>';
    }

    /** "+N older" badge HTML for a latest row that hides older namesakes. Empty unless "Latest only"
     *  is on and there is at least one older same-name log. Clicking it (handled in the events
     *  fragment via data-older-name) toggles that name into expandedOlderNames and re-renders. */
    function renderOlderBadge(s) {
        if (!sessionDisplayOptions.showLatestOnly) return '';
        // Controllers are never folded by "Latest only" (see visibleUnits), so every older run is
        // already a visible top-level row — a "+N older" badge would be a no-op that hides nothing.
        if (s.role === 'controller' || s._groupRole === 'controller') return '';
        var n = s._olderCount || 0;
        if (n <= 0) return '';
        var name = s._canonName || '';
        var expanded = !!(name && expandedOlderNames[name]);
        var label = (typeof vt === 'function') ? vt('viewer.session.olderCount', n) : ('+' + n + ' older');
        var title = (typeof vt === 'function')
            ? vt(expanded ? 'viewer.session.older.collapse' : 'viewer.session.older.expand')
            : label;
        var cls = 'session-older-toggle' + (expanded ? ' expanded' : '');
        return ' <span class="' + cls + '" role="button" tabindex="0" data-older-name="' + escapeAttr(name) + '"'
            + ' title="' + escapeAttr(title) + '" aria-pressed="' + (expanded ? 'true' : 'false') + '">'
            + escapeHtmlText(label) + '</span>';
    }
    `;
}
