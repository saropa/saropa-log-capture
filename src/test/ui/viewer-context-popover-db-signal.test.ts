/**
 * Regression tests for integration context popover: database line signal + Drift CTA gating.
 */
import * as assert from 'assert';
import { getContextPopoverScript } from '../../ui/viewer-context-menu/viewer-context-popover-script';
import { getViewerDataScript } from '../../ui/viewer/viewer-data';

suite('Context popover database signal', () => {
    test('embed defines line-local Database signal section', () => {
        const script = getContextPopoverScript();
        assert.ok(script.includes('buildDatabaseSignalPopoverSection'));
        assert.ok(script.includes('popover-section-db-signal'));
        assert.ok(script.includes('popover-sql-snippet'));
        assert.ok(script.includes('if (!ins) return'));
        assert.ok(script.includes('seenCountSafe'));
    });

    test('viewer data embed defines db rollup and sqlSnippet for dbSignal on lines', () => {
        const data = getViewerDataScript();
        assert.ok(data.includes('updateDbSignalRollup'));
        assert.ok(data.includes('sqlSnippet'));
    });

    test('Drift Advisor CTA is gated on driftAdvisorAvailable in popover markup', () => {
        const script = getContextPopoverScript();
        assert.ok(script.includes('window.driftAdvisorAvailable'));
        assert.ok(script.includes('if (driftAdvisorAvail)'));
        assert.ok(script.includes('if (driftAvail)'));
    });

    test('multiple Drift buttons use querySelectorAll for click binding', () => {
        const script = getContextPopoverScript();
        assert.ok(script.includes("querySelectorAll('.popover-drift-open')"));
    });
});
