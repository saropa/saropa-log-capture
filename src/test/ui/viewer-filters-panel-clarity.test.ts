import * as assert from 'assert';
import { getFiltersPanelHtml } from '../../ui/viewer-search-filter/viewer-filters-panel-html';
import { getFiltersPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';
import { getFilterScript } from '../../ui/viewer-search-filter/viewer-filter';
import { getExclusionScript } from '../../ui/viewer-search-filter/viewer-exclusions';
import { getToolbarScript } from '../../ui/viewer-toolbar/viewer-toolbar-script';

suite('Filters panel clarity (streams vs code location)', () => {
    test('HTML uses Log Streams, Code Location Scope, and scope narrowing wrapper ids', () => {
        const html = getFiltersPanelHtml();
        assert.ok(html.includes('Log Streams'));
        assert.ok(html.includes('SQL Commands'));
        assert.ok(html.includes('Code Location Scope'));
        assert.ok(html.includes('id="scope-narrowing-block"'));
        assert.ok(html.includes('id="scope-no-context-hint"'));
        assert.ok(html.includes('Hide lines without file path'));
        assert.ok(html.includes('id="source-streams-intro"'));
        assert.ok(html.includes('id="scope-filter-hint"'));
    });

    test('filters panel script groups external streams with a titled subsection', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('External sidecars ('));
        assert.ok(script.includes('source-external-group-title'));
        assert.ok(script.includes('commitSourceFilterFromCheckboxes'));
        assert.ok(script.includes('getSourceFilterCheckboxes'));
    });

    test('filters panel script maps external: stream ids to readable labels', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('External · '));
        assert.ok(script.includes('External (sidecar log)'));
        assert.ok(script.includes("id.indexOf('external:') === 0"));
    });

    test('scope script toggles narrowing visibility when no active editor', () => {
        const script = getScopeFilterScript();
        assert.ok(script.includes('function updateScopeNarrowingVisibility'));
        assert.ok(script.includes('scope-narrowing-block'));
        assert.ok(script.includes('scope-no-context-hint'));
        assert.ok(script.includes('!scopeContext.activeFilePath && scopeLevel'));
    });

    test('scope script updates contextual hint and hooks recalcHeights', () => {
        const script = getScopeFilterScript();
        assert.ok(script.includes('function updateScopeFilterHint'));
        assert.ok(script.includes('function scheduleScopeFilterHint'));
        assert.ok(script.includes('function flushScopeFilterHint'));
        assert.ok(script.includes('scope-filter-hint'));
        assert.ok(script.includes('_origRecalcForScopeHint'));
        assert.ok(script.includes('scheduleScopeFilterHint'));
        assert.ok(script.includes('scopeHintHiddenRatio = 0.75'));
        assert.ok(script.includes('scopeHintNoPathRatio = 0.25'));
        assert.ok(script.includes('data-scope-reset="all"'));
        assert.ok(script.includes('Reset to All logs'));
    });

    test('toolbar script should define setAccordionSummary helper', () => {
        const script = getToolbarScript();
        assert.ok(
            script.includes('function setAccordionSummary(sectionId, text)'),
            'toolbar script must define setAccordionSummary for use by filter sections',
        );
        assert.ok(
            script.includes('.filter-accordion-summary'),
            'setAccordionSummary should target the .filter-accordion-summary span',
        );
    });

    test('stream filter script should set accordion summary and tooltips', () => {
        const script = getFiltersPanelScript();
        assert.ok(
            script.includes("setAccordionSummary('source-filter-section'"),
            'stream filter should update accordion summary on change',
        );
        assert.ok(
            script.includes('Show or hide'),
            'stream rows should have descriptive tooltip text',
        );
    });

    test('output channels script should set accordion summary and tooltips', () => {
        const script = getFilterScript();
        assert.ok(
            script.includes("setAccordionSummary('output-channels-section'"),
            'channel filter should update accordion summary',
        );
        assert.ok(
            script.includes('Show or hide'),
            'channel labels should have descriptive tooltip text',
        );
    });

    test('exclusion script should set accordion summary', () => {
        const script = getExclusionScript();
        assert.ok(
            script.includes("setAccordionSummary('noise-section'"),
            'exclusion rebuild should update accordion summary',
        );
    });

    test('scope script should set accordion summary and clear on reset', () => {
        const script = getScopeFilterScript();
        assert.ok(
            script.includes("setAccordionSummary('scope-section'"),
            'scope filter should update accordion summary',
        );
        // resetScopeFilter should also clear the summary
        const resetIdx = script.indexOf('function resetScopeFilter');
        const resetBody = script.substring(resetIdx, script.indexOf('}', resetIdx + 30) + 1);
        assert.ok(
            resetBody.includes("setAccordionSummary('scope-section', '')"),
            'resetScopeFilter should clear accordion summary',
        );
    });
});
