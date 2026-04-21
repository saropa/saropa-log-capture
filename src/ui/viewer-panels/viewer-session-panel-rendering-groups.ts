/**
 * Session-group rendering helpers for the Logs panel webview.
 *
 * Returns a JS fragment that runs inside the same IIFE scope as the main
 * rendering script (viewer-session-panel-rendering.ts). That IIFE provides
 * `renderItem`, `escapeAttr`, and the panel-scope globals `collapsedGroups`
 * and `cachedSessions`.
 *
 * Extracted from viewer-session-panel-rendering.ts to keep that file under
 * the 300-line hard limit. See bugs/auto-group-related-sessions.md for the
 * full behaviour spec.
 */

/** Get the session-group rendering script fragment. */
export function getSessionGroupRenderingScript(): string {
    return /* javascript */ `
    /**
     * Scan a list of session records and emit HTML, coalescing consecutive
     * records that share a groupId into one .session-group wrapper.
     * Records without a groupId render as-is via renderItem.
     */
    function renderItemsWithGroupBlocks(sessions, bnCounts) {
        var out = [], i = 0;
        while (i < sessions.length) {
            var s = sessions[i];
            if (s && s.groupId) {
                var gid = s.groupId;
                var members = [];
                while (i < sessions.length && sessions[i] && sessions[i].groupId === gid) {
                    members.push(sessions[i]); i++;
                }
                out.push(renderSessionGroupBlock(gid, members, bnCounts));
            } else {
                out.push(renderItem(s, bnCounts));
                i++;
            }
        }
        return out.join('');
    }

    /**
     * Render one session-group wrapper + its member rows. Collapsed state is
     * read from the collapsedGroups object (mirrors collapsedDays).
     *
     * When collapsed, the primary renders with aggregate severity counts
     * summed across every member, and the secondaries are hidden via CSS.
     * When expanded, each row shows its own per-file counts.
     */
    function renderSessionGroupBlock(gid, members, bnCounts) {
        if (typeof collapsedGroups === 'undefined' || collapsedGroups === null) collapsedGroups = Object.create(null);
        var collapsed = !!collapsedGroups[gid];
        var parts = [
            '<div class="session-group" data-group-id="', escapeAttr(gid),
            '" data-collapsed="', collapsed ? 'true' : 'false', '">',
        ];
        for (var i = 0; i < members.length; i++) {
            var m = members[i];
            if (m.isGroupPrimary) {
                parts.push(renderItem(withGroupRole(m, 'primary', collapsed, members), bnCounts));
            } else {
                parts.push(renderItem(withGroupRole(m, 'secondary', collapsed, members), bnCounts));
            }
        }
        parts.push('</div>');
        return parts.join('');
    }

    /**
     * Build a shallow copy of a session record carrying internal hint fields
     * that renderItem reads to decide whether to emit group chrome.
     *
     * Fields injected (prefixed with _ to mark them as render-only hints):
     *   - _groupRole: primary or secondary
     *   - _groupCollapsed: whether the wrapper is collapsed
     *   - For primaries only, severity counts are replaced with the group
     *     aggregate when collapsed so the collapsed row's badge reflects
     *     the entire group's totals per the plan.
     */
    function withGroupRole(s, role, collapsed, members) {
        var copy = {};
        for (var k in s) copy[k] = s[k];
        copy._groupRole = role;
        copy._groupCollapsed = collapsed;
        if (role === 'primary' && collapsed) {
            var agg = aggregateGroupCounts(members);
            copy.errorCount = agg.errorCount;
            copy.warningCount = agg.warningCount;
            copy.perfCount = agg.perfCount;
            copy.anrCount = agg.anrCount;
            copy.fwCount = agg.fwCount;
            copy.infoCount = agg.infoCount;
        }
        return copy;
    }

    /** Sum severity counts across members, used to populate a collapsed primary's badges. */
    function aggregateGroupCounts(members) {
        var sum = { errorCount: 0, warningCount: 0, perfCount: 0, anrCount: 0, fwCount: 0, infoCount: 0 };
        for (var i = 0; i < members.length; i++) {
            var m = members[i];
            sum.errorCount += m.errorCount || 0;
            sum.warningCount += m.warningCount || 0;
            sum.perfCount += m.perfCount || 0;
            sum.anrCount += m.anrCount || 0;
            sum.fwCount += m.fwCount || 0;
            sum.infoCount += m.infoCount || 0;
        }
        return sum;
    }
    `;
}
