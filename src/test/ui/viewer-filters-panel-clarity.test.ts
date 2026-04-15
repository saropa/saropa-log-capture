import * as assert from 'assert';
import { getTagsPanelHtml } from '../../ui/viewer-search-filter/viewer-filters-panel-html';
import { getTagsPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';
import { getScopeFilterHintScript } from '../../ui/viewer-search-filter/viewer-scope-filter-hint';
import { getFilterScript } from '../../ui/viewer-search-filter/viewer-filter';
import { getExclusionScript } from '../../ui/viewer-search-filter/viewer-exclusions';
import { getToolbarScript } from '../../ui/viewer-toolbar/viewer-toolbar-script';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getPresetsScript } from '../../ui/viewer-search-filter/viewer-presets';

suite('Filters panel clarity (inputs, scope, noise reduction)', () => {
    test('Tags panel HTML has Message Tags, Code Origins, and SQL sections', () => {
        const html = getTagsPanelHtml();
        assert.ok(html.includes('Message Tags'));
        assert.ok(html.includes('Code Origins'));
        assert.ok(html.includes('SQL Commands'));
        assert.ok(html.includes('id="tags-panel"'), 'panel should have tags-panel id');
    });

    test('Tags panel script wires tier radio event handlers', () => {
        const script = getTagsPanelScript();
        assert.ok(script.includes('tier-flutter'), 'should wire Flutter DAP radio handlers');
        assert.ok(script.includes('tier-device'), 'should wire Device radio handlers');
        assert.ok(script.includes('tier-external'), 'should wire External radio handlers');
        assert.ok(script.includes('setShowExternal'), 'should call setShowExternal on change');
    });

    test('scope script disables unattributed checkbox when scope is all', () => {
        const script = getScopeFilterScript();
        assert.ok(script.includes('function updateScopeUnattribState'));
        assert.ok(script.includes('scope-hide-unattrib'));
        assert.ok(script.includes("scopeLevel !== 'all'"));
    });

    test('scope hint script updates contextual hint and hooks recalcHeights', () => {
        const script = getScopeFilterHintScript();
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

    test('Tags panel script should define updateLogSourcesSummary', () => {
        const script = getTagsPanelScript();
        assert.ok(
            script.includes('updateLogSourcesSummary'),
            'should define updateLogSourcesSummary for tier summary',
        );
    });

    test('category filter script should show log-sources-section on categories', () => {
        const script = getFilterScript();
        assert.ok(
            script.includes('log-sources-section'),
            'handleSetCategories should show the log-sources-section',
        );
    });

    test('exclusion script should set accordion summary', () => {
        const script = getExclusionScript();
        assert.ok(
            script.includes("setAccordionSummary('exclusions-section'"),
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

    test('drawer HTML should use new section names and not old ones', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('Log Streams'), 'drawer should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'drawer should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'drawer should not use old "Code Tags" title');
        assert.ok(!html.includes('sidecar'), 'drawer should not contain sidecar jargon');
        assert.ok(!html.includes('Log Inputs'), 'drawer should not use old "Log Inputs" title');
        assert.ok(html.includes('Log Sources'), 'drawer should use "Log Sources" title');
        assert.ok(html.includes('Text Exclusions'), 'drawer should use "Text Exclusions" title');
        assert.ok(html.includes('File Scope'), 'drawer should use "File Scope" title');
    });

    test('drawer should NOT contain tag/origin/SQL sections (moved to Tags panel)', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('Message Tags'), 'Message Tags moved to Tags panel');
        assert.ok(!html.includes('Code Origins'), 'Code Origins moved to Tags panel');
        assert.ok(!html.includes('SQL Commands'), 'SQL Commands moved to Tags panel');
    });

    test('Tags panel should not contain filter drawer controls', () => {
        const html = getTagsPanelHtml();
        assert.ok(!html.includes('Log Streams'), 'panel should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'panel should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'panel should not use old "Code Tags" title');
        assert.ok(!html.includes('output-channels-list'), 'panel should not have channel checkboxes');
        assert.ok(!html.includes('source-filter-list'), 'panel should not have source checkboxes');
        assert.ok(!html.includes('tier-flutter'), 'tier radios belong in the filter drawer');
        assert.ok(!html.includes('opt-exclusions'), 'exclusions belong in the filter drawer');
        assert.ok(html.includes('Message Tags'), 'panel should have Message Tags');
        assert.ok(html.includes('Code Origins'), 'panel should have Code Origins');
    });

    test('Tags panel script should not contain source checkbox code', () => {
        const script = getTagsPanelScript();
        assert.ok(!script.includes('sidecar'), 'should not use sidecar jargon');
        assert.ok(!script.includes('commitSourceFilterFromCheckboxes'), 'source checkboxes removed');
        assert.ok(!script.includes('getSourceFilterCheckboxes'), 'source checkboxes removed');
        assert.ok(!script.includes('syncSourceFilterUi'), 'source filter sync removed');
    });

    test('toolbar script should hide level dots when filter drawer opens', () => {
        const script = getToolbarScript();
        assert.ok(script.includes("levelMenuBtn"), 'should reference level-menu-btn element');
        assert.ok(script.includes("levelMenuBtn.classList.add('u-hidden')"), 'should hide dots on drawer open');
        assert.ok(script.includes("levelMenuBtn.classList.remove('u-hidden')"), 'should show dots on drawer close');
    });

    test('Log Sources should contain all three tier radio groups with hints', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('name="tier-flutter"'), 'should contain Flutter DAP radio group');
        assert.ok(html.includes('name="tier-device"'), 'should contain Device radio group');
        assert.ok(html.includes('name="tier-external"'), 'should contain External radio group');
        /* Flutter DAP label with DAP tooltip */
        assert.ok(html.includes('Flutter DAP'), 'should use "Flutter DAP" label');
        assert.ok(html.includes('Debug Adapter Protocol'), 'Flutter DAP should have DAP tooltip');
        /* Descriptions explain what each tier includes */
        assert.ok(html.includes('stdout, stderr, console'), 'Flutter DAP should list DAP categories');
        assert.ok(html.includes('Logcat'), 'Device should mention logcat');
        assert.ok(html.includes('Saved logs'), 'External should mention saved logs');
    });

    test('drawer HTML should not contain source/category checkbox containers', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('source-filter-list'), 'source checkboxes removed from drawer');
        assert.ok(!html.includes('output-channels-list'), 'category checkboxes removed from drawer');
    });

    test('Text Exclusions accordion should contain exclusion controls', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('exclusions-section'), 'should have exclusions-section');
        assert.ok(html.includes('opt-exclusions'), 'Text Exclusions should contain exclusion checkbox');
    });

    test('exclusion checkbox should be inline with text input in drawer', () => {
        const html = getFilterDrawerHtml();
        /* The checkbox label must be INSIDE the exclusion-input-wrapper,
         * not in a separate options-row above it. Verify ordering:
         * exclusion-toggle appears before exclusion-add-input, both inside the wrapper. */
        const wrapperStart = html.indexOf('exclusion-input-wrapper');
        const togglePos = html.indexOf('exclusion-toggle', wrapperStart);
        const inputPos = html.indexOf('exclusion-add-input', wrapperStart);
        assert.ok(wrapperStart > -1, 'should have exclusion-input-wrapper');
        assert.ok(togglePos > wrapperStart, 'checkbox toggle should be inside wrapper');
        assert.ok(inputPos > togglePos, 'text input should follow checkbox inside wrapper');
    });

    test('exclusion label should be screen-reader-only in drawer', () => {
        const drawerHtml = getFilterDrawerHtml();
        /* The exclusion-label span uses u-sr-only so the accordion header
         * provides the visible label while screen readers still get text. */
        assert.ok(drawerHtml.includes('u-sr-only'), 'drawer exclusion label should use u-sr-only');
    });

    test('drawer footer should say "Saved Filters" with "Default" option, no Reset button', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('>Saved Filters:</span>'), 'footer label should read "Saved Filters:"');
        assert.ok(html.includes('>Default</option>'), 'default option should read "Default"');
        assert.ok(!html.includes('reset-all-filters'), 'Reset all button should be removed');
    });

    test('preset save should capture tri-state tier modes for all three tiers', () => {
        const script = getPresetsScript();
        assert.ok(script.includes('filters.flutterMode'), 'should save flutterMode');
        assert.ok(script.includes('filters.deviceMode'), 'should save deviceMode');
        assert.ok(script.includes('filters.externalMode'), 'should save externalMode');
    });
});
