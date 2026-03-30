import * as assert from 'assert';
import { getFiltersPanelHtml } from '../../ui/viewer-search-filter/viewer-filters-panel-html';
import { getFiltersPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';
import { getFilterScript } from '../../ui/viewer-search-filter/viewer-filter';
import { getExclusionScript } from '../../ui/viewer-search-filter/viewer-exclusions';
import { getToolbarScript } from '../../ui/viewer-toolbar/viewer-toolbar-script';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getPresetsScript } from '../../ui/viewer-search-filter/viewer-presets';

suite('Filters panel clarity (inputs, scope, noise reduction)', () => {
    test('HTML uses Log Inputs, File Scope, and scope narrowing wrapper ids', () => {
        const html = getFiltersPanelHtml();
        assert.ok(html.includes('Log Inputs'));
        assert.ok(html.includes('SQL Commands'));
        assert.ok(html.includes('File Scope'));
        assert.ok(html.includes('id="scope-narrowing-block"'));
        assert.ok(html.includes('id="scope-no-context-hint"'));
        assert.ok(html.includes('Hide lines without file path'));
        assert.ok(html.includes('id="scope-filter-hint"'));
    });

    test('filters panel script maps external: stream ids to readable labels', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('External log'));
        assert.ok(script.includes("id.indexOf('external:') === 0"));
        assert.ok(script.includes('commitSourceFilterFromCheckboxes'));
        assert.ok(script.includes('getSourceFilterCheckboxes'));
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

    test('source filter script should update log inputs summary and tooltips', () => {
        const script = getFiltersPanelScript();
        assert.ok(
            script.includes('updateLogInputsSummary'),
            'source filter should call updateLogInputsSummary on change',
        );
        assert.ok(
            script.includes('Show or hide'),
            'stream rows should have descriptive tooltip text',
        );
    });

    test('category filter script should update log inputs summary and tooltips', () => {
        const script = getFilterScript();
        assert.ok(
            script.includes('updateLogInputsSummary'),
            'channel filter should call updateLogInputsSummary',
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

    test('drawer HTML should not contain old section names or sidecar jargon', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('Log Streams'), 'drawer should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'drawer should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'drawer should not use old "Code Tags" title');
        assert.ok(!html.includes('sidecar'), 'drawer should not contain sidecar jargon');
        assert.ok(html.includes('Log Inputs'), 'drawer should use "Log Inputs" title');
        assert.ok(html.includes('Noise Reduction'), 'drawer should use "Noise Reduction" title');
        assert.ok(html.includes('Message Tags'), 'drawer should use "Message Tags" title');
        assert.ok(html.includes('Code Origins'), 'drawer should use "Code Origins" title');
        assert.ok(html.includes('File Scope'), 'drawer should use "File Scope" title');
    });

    test('panel HTML should not contain old section names', () => {
        const html = getFiltersPanelHtml();
        assert.ok(!html.includes('Log Streams'), 'panel should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'panel should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'panel should not use old "Code Tags" title');
        assert.ok(html.includes('Noise Reduction'), 'panel should use "Noise Reduction" title');
        assert.ok(html.includes('Message Tags'), 'panel should use "Message Tags" title');
        assert.ok(html.includes('Code Origins'), 'panel should use "Code Origins" title');
    });

    test('source filter script should not contain sidecar jargon', () => {
        const script = getFiltersPanelScript();
        assert.ok(!script.includes('sidecar'), 'source filter should not use sidecar jargon');
        assert.ok(!script.includes('External (sidecar log)'), 'should not use old sidecar label');
        assert.ok(script.includes('External log'), 'should use clean "External log" label');
    });

    test('merged Log Inputs section should contain divider element', () => {
        const drawerHtml = getFilterDrawerHtml();
        assert.ok(drawerHtml.includes('id="log-inputs-divider"'), 'drawer should have divider between sources and categories');
        const panelHtml = getFiltersPanelHtml();
        assert.ok(panelHtml.includes('id="log-inputs-divider"'), 'panel should have divider between sources and categories');
    });

    test('updateLogInputsSummary should count both sources and categories', () => {
        const script = getFiltersPanelScript();
        assert.ok(script.includes('function updateLogInputsSummary'), 'should define updateLogInputsSummary');
        assert.ok(script.includes('source-filter-list'), 'should query source filter list');
        assert.ok(script.includes('output-channels-list'), 'should query output channels list');
        assert.ok(script.includes("setAccordionSummary('log-inputs-section'"), 'should target log-inputs-section');
    });

    test('toolbar script should hide level dots when filter drawer opens', () => {
        const script = getToolbarScript();
        assert.ok(script.includes("levelMenuBtn"), 'should reference level-menu-btn element');
        assert.ok(script.includes("levelMenuBtn.classList.add('u-hidden')"), 'should hide dots on drawer open');
        assert.ok(script.includes("levelMenuBtn.classList.remove('u-hidden')"), 'should show dots on drawer close');
    });

    test('Noise Reduction accordion should contain both App Only and Exclusions', () => {
        const html = getFilterDrawerHtml();
        const noiseIdx = html.indexOf('noise-section');
        assert.ok(noiseIdx >= 0, 'should have noise-section');
        const noiseBody = html.substring(noiseIdx, html.indexOf('</div>\n    </div>', noiseIdx + 200));
        assert.ok(noiseBody.includes('opt-app-only'), 'Noise Reduction should contain App Only checkbox');
        assert.ok(noiseBody.includes('opt-exclusions'), 'Noise Reduction should contain Exclusions checkbox');
    });

    test('preset save should capture appOnlyMode', () => {
        const script = getPresetsScript();
        assert.ok(
            script.includes('filters.appOnlyMode'),
            'getCurrentFilters should save appOnlyMode state',
        );
    });
});
