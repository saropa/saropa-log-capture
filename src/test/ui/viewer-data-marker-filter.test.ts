/**
 * String-level regression tests for the DB signal marker visibility + collapse pass.
 *
 * The actual pass runs in the webview and can't be exercised in Node, so these tests
 * assert the generated JS string contains the correct function names, state variables,
 * and wiring hooks. They guard against silent breakage of the three fixes landed for
 * the "unusable timestamp burst markers" report:
 *   (a) markers follow their anchor line's filter state
 *   (b) consecutive identical db-signal markers collapse into "× N"
 *   (c) user-facing toggle in the filter drawer
 */
import * as assert from 'node:assert';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';
import { getViewerDataMarkerFilterScript } from '../../ui/viewer/viewer-data-marker-filter';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getTagsPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';

suite('Viewer DB signal marker filter', () => {
    test('marker-filter embed defines both passes and the visibility toggle setter', () => {
        const js = getViewerDataMarkerFilterScript();
        assert.ok(js.includes('function applyDbSignalMarkerVisibility'), 'visibility pass');
        assert.ok(js.includes('function applyConsecutiveDbMarkerCollapse'), 'collapse pass');
        assert.ok(js.includes('function setDbSignalMarkersVisible'), 'toggle setter');
        assert.ok(js.includes('var dbSignalMarkersVisible = true'), 'default on');
        assert.ok(js.includes('isNonMarkerItemEffectivelyHidden'), 'shared hidden-state helper');
    });

    test('visibility pass hides markers when user toggle off, otherwise follows anchor filters', () => {
        const js = getViewerDataMarkerFilterScript();
        // Toggle-off branch must skip anchor probing entirely.
        assert.ok(js.includes('if (!dbSignalMarkersVisible)'));
        // Anchor lookup must use a seq → idx map (O(1) per marker).
        assert.ok(js.includes('seqToIdx'));
        // Orphan gate must read category 'db-signal'.
        assert.ok(js.includes("m.category !== 'db-signal'"));
    });

    test('collapse pass resets head on any visible non-marker line and increments on adjacency', () => {
        const js = getViewerDataMarkerFilterScript();
        assert.ok(js.includes('markerCollapsed = true'));
        assert.ok(js.includes('markerCollapseCount'));
        // A visible non-marker line must break the run (reset headIdx to -1).
        assert.ok(js.includes('headIdx = -1'));
    });

    test('full viewer data script wires both passes into recalcHeights before the height loop', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes('function applyDbSignalMarkerVisibility'), 'pass function present');
        assert.ok(data.includes('function applyConsecutiveDbMarkerCollapse'), 'collapse function present');
        // recalcHeights must invoke both (guards the ordering contract).
        const recalcIdx = data.indexOf('function recalcHeights');
        assert.ok(recalcIdx >= 0, 'recalcHeights present');
        const recalcBody = data.slice(recalcIdx, recalcIdx + 600);
        assert.ok(recalcBody.includes('applyDbSignalMarkerVisibility'), 'visibility called from recalc');
        assert.ok(recalcBody.includes('applyConsecutiveDbMarkerCollapse'), 'collapse called from recalc');
    });

    test('calcItemHeight returns 0 for markerHidden or markerCollapsed markers', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes('item.markerCollapsed'));
        assert.ok(data.includes('item.markerHidden'));
    });

    test('marker render branch surfaces collapse count via title attribute when count > 1', () => {
        const data = getViewerDataScript();
        // Visible "× N" badge was retired (unreadable per bugs/unified-line-collapsing.md);
        // collapse count is now exposed via a hover title on the marker div, preserving
        // the "nothing hidden silently" guarantee without re-adding a text badge.
        assert.ok(data.includes('item.markerCollapseCount > 1'), 'guard still gates the count > 1 branch');
        assert.ok(
            data.includes('adjacent identical markers collapsed into this one'),
            'title attribute communicates the collapse count on hover',
        );
        assert.ok(
            !data.includes('marker-collapse-count'),
            'retired badge class must not reappear (regression guard)',
        );
    });

    test('emitted markers carry anchorSeq so visibility pass can probe the anchor', () => {
        const data = getViewerDataScript();
        // applyDbMarkerResults now sets anchorSeq on the marker item.
        assert.ok(data.includes('anchorSeq: (typeof anc'));
    });

    test('filter drawer HTML exposes the "Show DB signal markers" checkbox under SQL Commands tab', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('opt-db-signal-markers'), 'toggle id present');
        assert.ok(html.includes('Show DB signal markers'), 'human label present');
        // Must live inside the sql-patterns-section tab panel (DB-related controls).
        const tabIdx = html.indexOf('id="sql-patterns-section"');
        const optIdx = html.indexOf('opt-db-signal-markers');
        assert.ok(tabIdx >= 0 && optIdx > tabIdx, 'checkbox is inside SQL Commands tab');
    });

    test('filter panel script wires toggle change handler and syncs checkbox on panel open', () => {
        const script = getTagsPanelScript();
        assert.ok(script.includes('opt-db-signal-markers'));
        assert.ok(script.includes('setDbSignalMarkersVisible'));
        // syncFiltersPanelUi() must reflect current dbSignalMarkersVisible on open.
        assert.ok(script.includes('dbSignalMarkersVisible'));
    });
});
