/**
 * Unread-delta badge logic for the icon bar, extracted from viewer-icon-bar.ts
 * to keep that file under the 300-line limit.
 *
 * Each icon-bar badge shows how many items arrived in its panel SINCE the user last
 * opened it — an unread counter, NOT the panel's absolute item total. Opening a panel
 * (or having it already open as items stream in) rebaselines it to zero. Baselines
 * persist in webview state so "unread" survives a viewer reload.
 *
 * Runs as its own IIFE, concatenated ahead of the main icon-bar script so that
 * window.updateIconBadge / window.acknowledgeIconBadge exist before any panel reports.
 * Coupling to the main script is via two window globals only:
 *   - window.__activeIconPanel : the panel currently open (set by setActivePanel)
 *   - window.acknowledgeIconBadge(name) : called when a panel is opened
 */

/** Generate the unread-delta badge script (defines window.updateIconBadge). */
export function getIconBarBadgeScript(): string {
    return /* js */ `
(function() {
    /* Panel name -> badge element id; the inline count element id is the same with -count. */
    var BADGE_PANELS = {
        signal: 'ib-signal-badge', sqlHistory: 'ib-sql-badge', integrations: 'ib-integrations-badge',
        crashlytics: 'ib-crashlytics-badge', collections: 'ib-collections-badge',
        bookmarks: 'ib-bookmarks-badge', trash: 'ib-trash-badge',
    };
    var PANEL_BY_BADGE = {};
    for (var _bp in BADGE_PANELS) { PANEL_BY_BADGE[BADGE_PANELS[_bp]] = _bp; }

    /* Latest absolute total each panel reported (in-memory; repopulated on reload). */
    var badgeTotals = {};
    /* Per-badge "already read up to this total" baseline (persisted). Lazy-loaded. */
    var badgeBaseline = null;
    var api = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);

    function loadBaseline() {
        if (badgeBaseline) { return badgeBaseline; }
        badgeBaseline = {};
        if (api) { var st = api.getState(); if (st && st.iconBadgeBaseline) { badgeBaseline = st.iconBadgeBaseline; } }
        return badgeBaseline;
    }
    function persistBaseline() {
        if (!api) { return; }
        var st = api.getState() || {};
        st.iconBadgeBaseline = badgeBaseline;
        api.setState(st);
    }

    /** Paint a badge overlay + inline count label with a concrete value (caps at 99+). */
    function renderBadge(badgeId, countId, value) {
        var text = value > 99 ? '99+' : String(value);
        var badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = text;
            badge.style.display = value > 0 ? 'inline-block' : 'none';
        }
        var countEl = document.getElementById(countId);
        if (countEl) {
            countEl.textContent = value > 0 ? ' (' + text + ')' : '';
        }
    }

    /**
     * Report a panel's CURRENT item total. Callers are unchanged — they still pass
     * their absolute total; the badge renders unread = max(0, total - baseline).
     * Badge ID convention: ib-{name}-badge, count ID: ib-{name}-count.
     */
    window.updateIconBadge = function(badgeId, countId, count) {
        count = count || 0;
        badgeTotals[badgeId] = count;
        var seen = loadBaseline();
        var panel = PANEL_BY_BADGE[badgeId];
        if (panel && panel === window.__activeIconPanel) {
            /* Panel is open in front of the user: acknowledge as fast as items arrive so a
               badge never lights on the very screen being read (mirrors the tab badge's
               suppress-while-visible behavior). Only persist when the baseline actually
               moves — a stable open panel re-reporting the same total must not thrash
               webview state on every message. */
            if (seen[badgeId] !== count) { seen[badgeId] = count; persistBaseline(); }
        } else if (seen[badgeId] === undefined || count < seen[badgeId]) {
            /* First sighting of this badge, or items were removed while the panel was closed —
               rebaseline so the delta never goes negative and later additions count from the
               current total rather than an inflated old one. */
            seen[badgeId] = count; persistBaseline();
        }
        renderBadge(badgeId, countId, Math.max(0, count - seen[badgeId]));
    };

    /** Mark a panel's current items as read; called by setActivePanel when the panel opens. */
    window.acknowledgeIconBadge = function(name) {
        var badgeId = BADGE_PANELS[name];
        if (!badgeId) { return; }
        /* Only rebaseline once this panel has reported a total THIS session. Right after a
           reload badgeTotals is empty; writing 0 here would clobber a good persisted
           baseline and later resurface the whole count as spurious unread. The panel
           renders on open and reports its total via updateIconBadge — as the active panel
           it hits the suppress-while-open path above and is acknowledged correctly. */
        if (badgeTotals[badgeId] === undefined) { return; }
        loadBaseline()[badgeId] = badgeTotals[badgeId];
        persistBaseline();
        renderBadge(badgeId, badgeId.replace('-badge', '-count'), 0);
    };
})();
`;
}
