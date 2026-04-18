import * as assert from 'assert';
import { getTagsPanelScript } from '../../ui/viewer-search-filter/viewer-filters-panel-script';
import { getScopeFilterScript } from '../../ui/viewer-search-filter/viewer-scope-filter';
import { getScopeFilterHintScript } from '../../ui/viewer-search-filter/viewer-scope-filter-hint';
import { getExclusionScript } from '../../ui/viewer-search-filter/viewer-exclusions';
import { getToolbarScript } from '../../ui/viewer-toolbar/viewer-toolbar-script';
import { getFilterDrawerHtml } from '../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html';
import { getPresetsScript } from '../../ui/viewer-search-filter/viewer-presets';

suite('Filters panel clarity (inputs, scope, noise reduction)', () => {
    test('Filter drawer tab bar should have all 6 tabs with icons', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('filter-tab-log-sources'), 'should have Log Sources tab');
        assert.ok(html.includes('filter-tab-exclusions'), 'should have Exclusions tab');
        assert.ok(html.includes('filter-tab-scope'), 'should have File Scope tab');
        assert.ok(html.includes('filter-tab-log-tags'), 'should have Message Tags tab');
        assert.ok(html.includes('filter-tab-class-tags'), 'should have Source Classes tab');
        assert.ok(html.includes('filter-tab-sql-patterns'), 'should have SQL Commands tab');
        /* Each tab should have a codicon */
        assert.ok(html.includes('codicon-broadcast'), 'Log Sources tab should have broadcast icon');
        assert.ok(html.includes('codicon-exclude'), 'Exclusions tab should have exclude icon');
        assert.ok(html.includes('codicon-folder-opened'), 'File Scope tab should have folder icon');
        assert.ok(html.includes('codicon-tag'), 'Message Tags tab should have tag icon');
        assert.ok(html.includes('codicon-symbol-class'), 'Source Classes tab should have class icon');
        assert.ok(html.includes('codicon-database'), 'SQL Commands tab should have database icon');
    });

    test('Filter drawer should contain tag/origin/SQL tab panels', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('source-tag-chips'), 'should have source tag chips container');
        assert.ok(html.includes('class-tag-chips'), 'should have class tag chips container');
        assert.ok(html.includes('sql-pattern-chips'), 'should have SQL pattern chips container');
    });

    test('Each tab should have a count suffix span', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('filter-tab-count-log-sources'), 'Log Sources tab count');
        assert.ok(html.includes('filter-tab-count-exclusions'), 'Exclusions tab count');
        assert.ok(html.includes('filter-tab-count-scope'), 'File Scope tab count');
        assert.ok(html.includes('filter-tab-count-log-tags'), 'Message Tags tab count');
        assert.ok(html.includes('filter-tab-count-class-tags'), 'Source Classes tab count');
        assert.ok(html.includes('filter-tab-count-sql-patterns'), 'SQL Commands tab count');
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

    test('toolbar script should define setAccordionSummary that updates tab counts', () => {
        const script = getToolbarScript();
        assert.ok(
            script.includes('function setAccordionSummary(sectionId, text)'),
            'toolbar script must define setAccordionSummary for backward compat',
        );
        assert.ok(
            script.includes('filter-tab-count-'),
            'setAccordionSummary should target filter-tab-count elements',
        );
    });

    test('toolbar script should define activateFilterTab for tab switching', () => {
        const script = getToolbarScript();
        assert.ok(
            script.includes('function activateFilterTab(key)'),
            'toolbar script must define activateFilterTab',
        );
        assert.ok(
            script.includes('initFilterTabs'),
            'toolbar script must call initFilterTabs',
        );
    });

    test('Tags panel script should define updateLogSourcesSummary', () => {
        const script = getTagsPanelScript();
        assert.ok(
            script.includes('updateLogSourcesSummary'),
            'should define updateLogSourcesSummary for tier summary',
        );
    });

    test('exclusion script should set accordion summary', () => {
        const script = getExclusionScript();
        assert.ok(
            script.includes("setAccordionSummary('exclusions-section'"),
            'exclusion rebuild should update tab count via setAccordionSummary',
        );
    });

    test('scope script should set accordion summary and clear on reset', () => {
        const script = getScopeFilterScript();
        assert.ok(
            script.includes("setAccordionSummary('scope-section'"),
            'scope filter should update tab count via setAccordionSummary',
        );
        const resetIdx = script.indexOf('function resetScopeFilter');
        const resetBody = script.substring(resetIdx, script.indexOf('}', resetIdx + 30) + 1);
        assert.ok(
            resetBody.includes("setAccordionSummary('scope-section', '')"),
            'resetScopeFilter should clear tab count',
        );
    });

    test('drawer HTML should use correct section names and not old ones', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('Log Streams'), 'drawer should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'drawer should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'drawer should not use old "Code Tags" title');
        assert.ok(!html.includes('sidecar'), 'drawer should not contain sidecar jargon');
        assert.ok(!html.includes('Log Inputs'), 'drawer should not use old "Log Inputs" title');
        assert.ok(html.includes('Log Sources'), 'drawer should use "Log Sources" title');
        assert.ok(html.includes('File Scope'), 'drawer should use "File Scope" title');
    });

    test('Tags panel script should not contain source checkbox code', () => {
        const script = getTagsPanelScript();
        assert.ok(!script.includes('sidecar'), 'should not use sidecar jargon');
        assert.ok(!script.includes('commitSourceFilterFromCheckboxes'), 'source checkboxes removed');
        assert.ok(!script.includes('getSourceFilterCheckboxes'), 'source checkboxes removed');
        assert.ok(!script.includes('syncSourceFilterUi'), 'source filter sync removed');
    });

    test('toolbar filter button should toggle filter panel via setActivePanel', () => {
        const script = getToolbarScript();
        /* Filter panel is a sidebar, not a dropdown — toolbar button
         * calls setActivePanel('filters') to open it in panel-slot. */
        assert.ok(
            script.includes("setActivePanel('filters')"),
            'filter button should toggle via setActivePanel',
        );
    });

    test('Log Sources should contain all three tier radio groups with hints', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('name="tier-flutter"'), 'should contain Flutter DAP radio group');
        assert.ok(html.includes('name="tier-device"'), 'should contain Device radio group');
        assert.ok(html.includes('name="tier-external"'), 'should contain External radio group');
        assert.ok(html.includes('Flutter DAP'), 'should use "Flutter DAP" label');
        assert.ok(html.includes('Debug Adapter Protocol'), 'Flutter DAP should have DAP tooltip');
        assert.ok(html.includes('stdout, stderr, console'), 'Flutter DAP should list DAP categories');
        assert.ok(html.includes('Logcat'), 'Device should mention logcat');
        assert.ok(html.includes('Saved logs'), 'External should mention saved logs');
    });

    test('drawer HTML should not contain source/category checkbox containers', () => {
        const html = getFilterDrawerHtml();
        assert.ok(!html.includes('source-filter-list'), 'source checkboxes removed from drawer');
        assert.ok(!html.includes('output-channels-list'), 'category checkboxes removed from drawer');
    });

    test('Exclusions tab panel should contain exclusion controls', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('exclusions-section'), 'should have exclusions-section');
        assert.ok(html.includes('opt-exclusions'), 'Exclusions panel should contain exclusion checkbox');
    });

    test('exclusion checkbox should be inline with text input in drawer', () => {
        const html = getFilterDrawerHtml();
        const wrapperStart = html.indexOf('exclusion-input-wrapper');
        const togglePos = html.indexOf('exclusion-toggle', wrapperStart);
        const inputPos = html.indexOf('exclusion-add-input', wrapperStart);
        assert.ok(wrapperStart > -1, 'should have exclusion-input-wrapper');
        assert.ok(togglePos > wrapperStart, 'checkbox toggle should be inside wrapper');
        assert.ok(inputPos > togglePos, 'text input should follow checkbox inside wrapper');
    });

    test('exclusion label should be screen-reader-only in drawer', () => {
        const drawerHtml = getFilterDrawerHtml();
        assert.ok(drawerHtml.includes('u-sr-only'), 'drawer exclusion label should use u-sr-only');
    });

    test('drawer footer should say "Saved Filters" with "Default" option, no Reset button', () => {
        const html = getFilterDrawerHtml();
        assert.ok(html.includes('id="preset-select"'), 'hidden preset select must exist');
        assert.ok(html.includes('>Default</option>'), 'default option should read "Default"');
        assert.ok(!html.includes('filter-drawer-footer-label'), 'old footer label should be removed');
        assert.ok(!html.includes('reset-all-filters'), 'Reset all button should be removed');
    });

    test('preset save should capture tri-state tier modes for all three tiers', () => {
        const script = getPresetsScript();
        assert.ok(script.includes('filters.flutterMode'), 'should save flutterMode');
        assert.ok(script.includes('filters.deviceMode'), 'should save deviceMode');
        assert.ok(script.includes('filters.externalMode'), 'should save externalMode');
    });
});
