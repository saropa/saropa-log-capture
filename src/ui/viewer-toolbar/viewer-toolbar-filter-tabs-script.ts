/**
 * Filter tab bar interaction: tab activation, label visibility, and per-tab count suffix.
 * Concatenated into the viewer toolbar script; extracted from viewer-toolbar-script.ts
 * to keep that file under the 300-line limit.
 */
export function getFilterTabsScript(): string {
    return /* javascript */ `
(function() {
    var filterTabMap = {
        'log-sources': 'log-sources-section',
        'exclusions': 'exclusions-section',
        'scope': 'scope-section',
        'log-tags': 'log-tags-section',
        'class-tags': 'class-tags-section',
        'sql-patterns': 'sql-patterns-section',
    };

    function activateFilterTab(key) {
        var tabs = document.querySelectorAll('.filter-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].setAttribute('aria-selected', 'false');
        }
        var tab = document.getElementById('filter-tab-' + key);
        if (tab) tab.setAttribute('aria-selected', 'true');
        for (var k in filterTabMap) {
            var panel = document.getElementById(filterTabMap[k]);
            if (panel) panel.style.display = (k === key) ? '' : 'none';
        }
    }

    function handleFilterTabClick(e) {
        var btn = e.currentTarget;
        if (!btn || !btn.id) return;
        var key = btn.id.replace('filter-tab-', '');
        activateFilterTab(key);
    }

    /* ---- Filter tab label toggle (click whitespace to toggle) ---- */

    var ftApi = typeof vscodeApi !== 'undefined' ? vscodeApi : (window._vscodeApi || null);
    function getFilterTabLabelsVisible() {
        if (!ftApi) return true;
        var st = ftApi.getState();
        /* Default to true (labels visible) */
        return !st || st.filterTabLabelsVisible !== false;
    }
    function setFilterTabLabelsVisible(visible) {
        if (!ftApi) return;
        var st = ftApi.getState() || {};
        st.filterTabLabelsVisible = !!visible;
        ftApi.setState(st);
    }
    function applyFilterTabLabels() {
        var bar = document.querySelector('.filter-tab-bar');
        if (bar) bar.classList.toggle('ftb-labels-visible', getFilterTabLabelsVisible());
    }

    function initFilterTabs() {
        var tabs = document.querySelectorAll('.filter-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', handleFilterTabClick);
        }
        activateFilterTab('log-sources');
        applyFilterTabLabels();

        /* Click on tab bar whitespace (not on a tab button) toggles labels */
        var bar = document.querySelector('.filter-tab-bar');
        if (bar) {
            bar.addEventListener('click', function(e) {
                var t = e.target;
                while (t && t !== bar) {
                    if (t.classList && t.classList.contains('filter-tab')) return;
                    t = t.parentElement;
                }
                setFilterTabLabelsVisible(!getFilterTabLabelsVisible());
                applyFilterTabLabels();
            });
        }
    }

    initFilterTabs();
})();

/**
 * Update the count suffix on a filter tab.
 * Maps panel section ID (e.g. 'log-sources-section') to the
 * corresponding tab count span (e.g. 'filter-tab-count-log-sources').
 * Kept as setAccordionSummary for backward compat with callers.
 */
function setAccordionSummary(sectionId, text) {
    var key = sectionId.replace(/-section$/, '');
    var el = document.getElementById('filter-tab-count-' + key);
    if (el) el.textContent = text ? '(' + text + ')' : '';
}
`;
}
