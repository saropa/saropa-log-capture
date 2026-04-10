"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const viewer_filters_panel_html_1 = require("../../ui/viewer-search-filter/viewer-filters-panel-html");
const viewer_filters_panel_script_1 = require("../../ui/viewer-search-filter/viewer-filters-panel-script");
const viewer_scope_filter_1 = require("../../ui/viewer-search-filter/viewer-scope-filter");
const viewer_scope_filter_hint_1 = require("../../ui/viewer-search-filter/viewer-scope-filter-hint");
const viewer_filter_1 = require("../../ui/viewer-search-filter/viewer-filter");
const viewer_exclusions_1 = require("../../ui/viewer-search-filter/viewer-exclusions");
const viewer_toolbar_script_1 = require("../../ui/viewer-toolbar/viewer-toolbar-script");
const viewer_toolbar_filter_drawer_html_1 = require("../../ui/viewer-toolbar/viewer-toolbar-filter-drawer-html");
const viewer_presets_1 = require("../../ui/viewer-search-filter/viewer-presets");
suite('Filters panel clarity (inputs, scope, noise reduction)', () => {
    test('HTML uses Log Inputs, File Scope, and scope element ids', () => {
        const html = (0, viewer_filters_panel_html_1.getFiltersPanelHtml)();
        assert.ok(html.includes('Log Inputs'));
        assert.ok(html.includes('SQL Commands'));
        assert.ok(html.includes('File Scope'));
        assert.ok(html.includes('id="scope-filter-hint"'));
    });
    test('filters panel script maps external: stream ids to readable labels', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(script.includes('External log'));
        assert.ok(script.includes("id.indexOf('external:') === 0"));
        assert.ok(script.includes('commitSourceFilterFromCheckboxes'));
        assert.ok(script.includes('getSourceFilterCheckboxes'));
    });
    test('scope script disables unattributed checkbox when scope is all', () => {
        const script = (0, viewer_scope_filter_1.getScopeFilterScript)();
        assert.ok(script.includes('function updateScopeUnattribState'));
        assert.ok(script.includes('scope-hide-unattrib'));
        assert.ok(script.includes("scopeLevel !== 'all'"));
    });
    test('scope hint script updates contextual hint and hooks recalcHeights', () => {
        const script = (0, viewer_scope_filter_hint_1.getScopeFilterHintScript)();
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
        const script = (0, viewer_toolbar_script_1.getToolbarScript)();
        assert.ok(script.includes('function setAccordionSummary(sectionId, text)'), 'toolbar script must define setAccordionSummary for use by filter sections');
        assert.ok(script.includes('.filter-accordion-summary'), 'setAccordionSummary should target the .filter-accordion-summary span');
    });
    test('source filter script should update log inputs summary and tooltips', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(script.includes('updateLogInputsSummary'), 'source filter should call updateLogInputsSummary on change');
        assert.ok(script.includes('Show or hide'), 'stream rows should have descriptive tooltip text');
    });
    test('category filter script should update log inputs summary and tooltips', () => {
        const script = (0, viewer_filter_1.getFilterScript)();
        assert.ok(script.includes('updateLogInputsSummary'), 'channel filter should call updateLogInputsSummary');
        assert.ok(script.includes('Show or hide'), 'channel labels should have descriptive tooltip text');
    });
    test('exclusion script should set accordion summary', () => {
        const script = (0, viewer_exclusions_1.getExclusionScript)();
        assert.ok(script.includes("setAccordionSummary('exclusions-section'"), 'exclusion rebuild should update accordion summary');
    });
    test('scope script should set accordion summary and clear on reset', () => {
        const script = (0, viewer_scope_filter_1.getScopeFilterScript)();
        assert.ok(script.includes("setAccordionSummary('scope-section'"), 'scope filter should update accordion summary');
        // resetScopeFilter should also clear the summary
        const resetIdx = script.indexOf('function resetScopeFilter');
        const resetBody = script.substring(resetIdx, script.indexOf('}', resetIdx + 30) + 1);
        assert.ok(resetBody.includes("setAccordionSummary('scope-section', '')"), 'resetScopeFilter should clear accordion summary');
    });
    test('drawer HTML should not contain old section names or sidecar jargon', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(!html.includes('Log Streams'), 'drawer should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'drawer should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'drawer should not use old "Code Tags" title');
        assert.ok(!html.includes('sidecar'), 'drawer should not contain sidecar jargon');
        assert.ok(html.includes('Log Inputs'), 'drawer should use "Log Inputs" title');
        assert.ok(html.includes('Exclusions'), 'drawer should use "Exclusions" title');
        assert.ok(html.includes('Message Tags'), 'drawer should use "Message Tags" title');
        assert.ok(html.includes('Code Origins'), 'drawer should use "Code Origins" title');
        assert.ok(html.includes('File Scope'), 'drawer should use "File Scope" title');
    });
    test('panel HTML should not contain old section names', () => {
        const html = (0, viewer_filters_panel_html_1.getFiltersPanelHtml)();
        assert.ok(!html.includes('Log Streams'), 'panel should not use old "Log Streams" title');
        assert.ok(!html.includes('Output Channels'), 'panel should not use old "Output Channels" title');
        assert.ok(!html.includes('Code Tags'), 'panel should not use old "Code Tags" title');
        assert.ok(html.includes('Exclusions'), 'panel should use "Exclusions" title');
        assert.ok(html.includes('Message Tags'), 'panel should use "Message Tags" title');
        assert.ok(html.includes('Code Origins'), 'panel should use "Code Origins" title');
    });
    test('source filter script should not contain sidecar jargon', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(!script.includes('sidecar'), 'source filter should not use sidecar jargon');
        assert.ok(!script.includes('External (sidecar log)'), 'should not use old sidecar label');
        assert.ok(script.includes('External log'), 'should use clean "External log" label');
    });
    test('merged Log Inputs section should contain divider element', () => {
        const drawerHtml = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(drawerHtml.includes('id="log-inputs-divider"'), 'drawer should have divider between sources and categories');
        const panelHtml = (0, viewer_filters_panel_html_1.getFiltersPanelHtml)();
        assert.ok(panelHtml.includes('id="log-inputs-divider"'), 'panel should have divider between sources and categories');
    });
    test('updateLogInputsSummary should count both sources and categories', () => {
        const script = (0, viewer_filters_panel_script_1.getFiltersPanelScript)();
        assert.ok(script.includes('function updateLogInputsSummary'), 'should define updateLogInputsSummary');
        assert.ok(script.includes('source-filter-list'), 'should query source filter list');
        assert.ok(script.includes('output-channels-list'), 'should query output channels list');
        assert.ok(script.includes("setAccordionSummary('log-inputs-section'"), 'should target log-inputs-section');
    });
    test('toolbar script should hide level dots when filter drawer opens', () => {
        const script = (0, viewer_toolbar_script_1.getToolbarScript)();
        assert.ok(script.includes("levelMenuBtn"), 'should reference level-menu-btn element');
        assert.ok(script.includes("levelMenuBtn.classList.add('u-hidden')"), 'should hide dots on drawer open');
        assert.ok(script.includes("levelMenuBtn.classList.remove('u-hidden')"), 'should show dots on drawer close');
    });
    test('Log Inputs should contain Flutter and Device checkboxes', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(html.includes('opt-flutter'), 'Log Inputs should contain Flutter checkbox');
        assert.ok(html.includes('opt-device'), 'Log Inputs should contain Device checkbox');
    });
    test('Exclusions accordion should contain exclusion controls', () => {
        const html = (0, viewer_toolbar_filter_drawer_html_1.getFilterDrawerHtml)();
        assert.ok(html.includes('exclusions-section'), 'should have exclusions-section');
        assert.ok(html.includes('opt-exclusions'), 'Exclusions should contain exclusion checkbox');
    });
    test('preset save should capture deviceEnabled', () => {
        const script = (0, viewer_presets_1.getPresetsScript)();
        assert.ok(script.includes('filters.deviceEnabled'), 'getCurrentFilters should save deviceEnabled state');
    });
});
//# sourceMappingURL=viewer-filters-panel-clarity.test.js.map